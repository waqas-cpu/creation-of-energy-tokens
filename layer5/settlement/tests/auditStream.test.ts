import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auditRecordFromResult, AuditStore } from "../src/auditStore.js";
import { startSettlementApiServer } from "../src/settlementApiServer.js";
import type { ContractId, ExecutionId, ExecutionResult } from "../src/types.js";

function settledResult(
  contractHex: string,
  execHex: string,
  txHex: string,
): ExecutionResult {
  return {
    contractId: contractHex as ContractId,
    executionId: execHex as ExecutionId,
    txHash: txHex as `0x${string}`,
    executionBlock: 1,
    confirmationBlock: 2,
    settled: true,
    rollbackReason: "0x" + "0".repeat(64) as `0x${string}`,
    proofIds: [],
    regulatoryReportCid: "0x" + "0".repeat(64) as `0x${string}`,
    gasUsed: 1n,
  };
}

describe("GET /audit/stream", () => {
  let prevPoll: string | undefined;

  beforeEach(() => {
    prevPoll = process.env.SETTLEMENT_AUDIT_STREAM_POLL_MS;
    process.env.SETTLEMENT_AUDIT_STREAM_POLL_MS = "100";
  });

  afterEach(() => {
    if (prevPoll !== undefined) process.env.SETTLEMENT_AUDIT_STREAM_POLL_MS = prevPoll;
    else delete process.env.SETTLEMENT_AUDIT_STREAM_POLL_MS;
  });

  it("emits SSE data lines for appended audit rows", async () => {
    const audit = new AuditStore();
    const cid = ("0x" + "aa".repeat(32)) as `0x${string}`;
    const rid = ("0x" + "bb".repeat(32)) as `0x${string}`;
    audit.append(
      auditRecordFromResult(
        settledResult("0x" + "11".repeat(32), "0x" + "22".repeat(32), "0x" + "33".repeat(32)),
        cid,
        rid,
      ),
    );

    const server = startSettlementApiServer(audit, 0);
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const addr = server.address();
    if (addr == null || typeof addr === "string") throw new Error("expected tcp address");
    const port = addr.port;
    const url = `http://127.0.0.1:${port}/audit/stream`;

    const ac = new AbortController();
    const res = await fetch(url, { signal: ac.signal });
    expect(res.ok).toBe(true);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let acc = "";
    const deadline = Date.now() + 5000;
    const countData = () => (acc.match(/^data: /gm) ?? []).length;

    while (countData() < 1 && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      acc += dec.decode(value, { stream: true });
    }
    expect(countData()).toBeGreaterThanOrEqual(1);
    expect(acc).toContain("executionId");

    const cid2 = ("0x" + "cc".repeat(32)) as `0x${string}`;
    const rid2 = ("0x" + "dd".repeat(32)) as `0x${string}`;
    audit.append(
      auditRecordFromResult(
        settledResult("0x" + "44".repeat(32), "0x" + "55".repeat(32), "0x" + "66".repeat(32)),
        cid2,
        rid2,
      ),
    );

    while (countData() < 2 && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      acc += dec.decode(value, { stream: true });
    }
    expect(countData()).toBeGreaterThanOrEqual(2);

    ac.abort();
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
