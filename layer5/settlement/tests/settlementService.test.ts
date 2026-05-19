import { describe, expect, it } from "vitest";
import { SettlementService } from "../src/settlementService.js";
import type { ContractId, ExecutionId } from "../src/types.js";

describe("SettlementService", () => {
  it("archives proof and generates report (gates 4.8.3–4.8.4)", async () => {
    const svc = new SettlementService();
    const result = await svc.process({
      contractId: ("0x" + "11".repeat(32)) as ContractId,
      executionId: ("0x" + "22".repeat(32)) as ExecutionId,
      txHash: "0x" + "33".repeat(32),
      executionBlock: 100,
      confirmationBlock: 112,
      settled: true,
      rollbackReason: "0x" + "0".repeat(64),
      proofIds: [],
      regulatoryReportCid: "0x" + "0".repeat(64),
      gasUsed: 50_000n,
    });

    expect(result.acknowledged).toBe(true);
    expect(result.proofIds.length).toBe(1);
    expect(svc.auditStore.list().length).toBe(1);
  });
});
