import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuditStore, auditRecordFromResult } from "../src/auditStore.js";
import { createPersistenceFromEnv } from "../src/persistence/createPersistenceFromEnv.js";
import { SettlementService } from "../src/settlementService.js";
import { createSettlementBackendServer } from "../src/settlementBackendServer.js";
import type { ContractId, ExecutionId } from "../src/types.js";

const API_KEY = "test-backend-smoke-key";
const TEST_PORT = 0;

const activeServers: Server[] = [];

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
}

async function startTestServer(
  audit = new AuditStore(),
  withAuth = true,
): Promise<{ port: number; close: () => Promise<void> }> {
  if (withAuth) process.env.SETTLEMENT_API_KEY = API_KEY;
  else delete process.env.SETTLEMENT_API_KEY;
  process.env.SETTLEMENT_API_PUBLIC_READ = "true";

  const persistence = createPersistenceFromEnv();
  const server = createSettlementBackendServer({
    audit,
    persistence: {
      audit,
      archive: persistence.archive,
      reporter: persistence.reporter,
    },
  });
  activeServers.push(server);

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
    server.listen(TEST_PORT);
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("expected port");
  return {
    port: addr.port,
    close: () =>
      new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}

function authHeaders(): Record<string, string> {
  return { "X-Settlement-Api-Key": API_KEY };
}

describe("settlement backend smoke", () => {
  let prevApiKey: string | undefined;
  let prevPublicRead: string | undefined;
  let prevDataDir: string | undefined;

  beforeEach(() => {
    prevApiKey = process.env.SETTLEMENT_API_KEY;
    prevPublicRead = process.env.SETTLEMENT_API_PUBLIC_READ;
    prevDataDir = process.env.SETTLEMENT_DATA_DIR;
    delete process.env.SETTLEMENT_DATA_DIR;
  });

  afterEach(async () => {
    while (activeServers.length > 0) {
      const server = activeServers.pop()!;
      if (server.listening) await closeServer(server);
    }
    if (prevApiKey !== undefined) process.env.SETTLEMENT_API_KEY = prevApiKey;
    else delete process.env.SETTLEMENT_API_KEY;
    if (prevPublicRead !== undefined) process.env.SETTLEMENT_API_PUBLIC_READ = prevPublicRead;
    else delete process.env.SETTLEMENT_API_PUBLIC_READ;
    if (prevDataDir !== undefined) process.env.SETTLEMENT_DATA_DIR = prevDataDir;
    else delete process.env.SETTLEMENT_DATA_DIR;
  });

  it("GET /health returns ok", async () => {
    const { port, close } = await startTestServer();
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toContain("settlement");
    await close();
  });

  it("GET /audit returns records", async () => {
    const audit = new AuditStore();
    audit.append(
      auditRecordFromResult(
        {
          contractId: ("0x" + "11".repeat(32)) as ContractId,
          executionId: ("0x" + "22".repeat(32)) as ExecutionId,
          txHash: "0x" + "33".repeat(32),
          executionBlock: 1,
          confirmationBlock: 2,
          settled: true,
          rollbackReason: "0x" + "0".repeat(64),
          proofIds: [],
          regulatoryReportCid: "0x" + "0".repeat(64),
          gasUsed: 1n,
        },
        "0x" + "aa".repeat(32),
        "0x" + "bb".repeat(32),
      ),
    );
    const { port, close } = await startTestServer(audit);
    const res = await fetch(`http://127.0.0.1:${port}/audit`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { records: unknown[] };
    expect(body.records.length).toBe(1);
    await close();
  });

  it("GET /v1/gates returns checklist JSON", async () => {
    process.env.GATE_CHECK_RPC = "false";
    const { port, close } = await startTestServer();
    const res = await fetch(`http://127.0.0.1:${port}/v1/gates`, { headers: authHeaders() });
    expect(res.status).toBeGreaterThanOrEqual(200);
    const body = (await res.json()) as { gates: unknown[]; network: string };
    expect(Array.isArray(body.gates)).toBe(true);
    expect(body.network).toBeTruthy();
    await close();
  });

  it("rejects write routes without API key when auth enabled", async () => {
    process.env.SETTLEMENT_API_PUBLIC_READ = "false";
    const { port, close } = await startTestServer(new AuditStore(), true);
    const res = await fetch(`http://127.0.0.1:${port}/v1/redemption/dry-run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        consumer: "0x" + "01".repeat(32),
        kwhClaim: "1",
      }),
    });
    expect(res.status).toBe(401);
    await close();
  });

  it("POST /v1/redemption/dry-run succeeds with API key (stub PTB)", async () => {
    const { port, close } = await startTestServer();
    const res = await fetch(`http://127.0.0.1:${port}/v1/redemption/dry-run`, {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({
        consumer: "0x" + "01".repeat(32),
        kwhClaim: "1",
        coinBalanceMicro: "1000000",
        batchKwh: "1",
        batchRedeemed: false,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { dryRun: { success: boolean } };
    expect(body.dryRun.success).toBe(true);
    await close();
  });

  it("POST /v1/settlement/process appends audit row", async () => {
    const audit = new AuditStore();
    const dir = mkdtempSync(join(tmpdir(), "settlement-smoke-"));
    process.env.SETTLEMENT_DATA_DIR = dir;
    process.env.IPFS_PROVIDER = "none";
    const persistence = createPersistenceFromEnv();
    const settlement = new SettlementService(persistence);

    delete process.env.SETTLEMENT_API_KEY;
    const server = createSettlementBackendServer({
      audit: persistence.audit,
      persistence,
    });
    activeServers.push(server);
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
      server.listen(TEST_PORT);
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("port");
    const port = addr.port;

    const res = await fetch(`http://127.0.0.1:${port}/v1/settlement/process`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contractId: "0x" + "11".repeat(32),
        executionId: "0x" + "22".repeat(32),
        txHash: "0x" + "33".repeat(32),
        executionBlock: 1,
        confirmationBlock: 3,
        settled: true,
        rollbackReason: "0x" + "0".repeat(64),
        gasUsed: "50000",
        options: { consumer: "0x" + "01".repeat(32), kwhClaim: "1" },
      }),
    });
    expect(res.status).toBe(200);
    const outcome = (await res.json()) as { acknowledged: boolean };
    expect(outcome.acknowledged).toBe(true);
    expect(persistence.audit.list().length).toBeGreaterThanOrEqual(1);

    await closeServer(server);
    const idx = activeServers.indexOf(server);
    if (idx >= 0) activeServers.splice(idx, 1);
  });
});
