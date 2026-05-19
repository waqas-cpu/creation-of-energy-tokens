import { existsSync, readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettlementService } from "../src/settlementService.js";
import type { ContractId, ExecutionId } from "../src/types.js";

describe("disk persistence (SETTLEMENT_DATA_DIR)", () => {
  let prevDataDir: string | undefined;

  beforeEach(() => {
    prevDataDir = process.env.SETTLEMENT_DATA_DIR;
  });

  afterEach(() => {
    if (prevDataDir !== undefined) process.env.SETTLEMENT_DATA_DIR = prevDataDir;
    else delete process.env.SETTLEMENT_DATA_DIR;
  });

  it("writes audit.jsonl and proof JSON under the data directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "settlement-disk-"));
    process.env.SETTLEMENT_DATA_DIR = dir;

    const executionId = ("0x" + "22".repeat(32)) as ExecutionId;
    const svc = new SettlementService();
    await svc.process({
      contractId: ("0x" + "11".repeat(32)) as ContractId,
      executionId,
      txHash: "0x" + "33".repeat(32),
      executionBlock: 100,
      confirmationBlock: 112,
      settled: true,
      rollbackReason: "0x" + "0".repeat(64),
      proofIds: [],
      regulatoryReportCid: "0x" + "0".repeat(64),
      gasUsed: 50_000n,
    });

    const auditPath = join(dir, "audit.jsonl");
    const proofPath = join(dir, "proofs", `${executionId}.json`);
    expect(existsSync(auditPath)).toBe(true);
    expect(existsSync(proofPath)).toBe(true);
    const line = readFileSync(auditPath, "utf8").trim().split("\n").pop();
    expect(line).toBeTruthy();
    const row = JSON.parse(line!) as { executionId: string; gasUsed: string };
    expect(row.executionId).toBe(executionId);
    expect(row.gasUsed).toBe("50000");
  });
});
