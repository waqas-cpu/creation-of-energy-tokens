import { describe, expect, it } from "vitest";
import { assertCreditOrThrow, validateCredit } from "../src/creditValidation.js";
import { CarbonCreditBridge } from "../src/carbonBridge.js";
import { SettlementOrchestrator } from "../src/settlementOrchestrator.js";
import { UsdcSettlementAdapter } from "../src/usdcSettlement.js";
import { BridgeWatcher } from "../src/bridgeWatcher.js";
import { SettlementService } from "../src/settlementService.js";
import type { ContractId, ExecutionId } from "../src/types.js";

describe("Layer 5 modules", () => {
  it("validates credit read-only (gate 5.1.2)", () => {
    const ok = validateCredit({
      coinBalanceMicro: 1_000_000n,
      batchKwh: 1n,
      batchRedeemed: false,
      kwhClaim: 1n,
    });
    expect(ok.ok).toBe(true);
    expect(assertCreditOrThrow({
      coinBalanceMicro: 1_000_000n,
      batchKwh: 1n,
      batchRedeemed: false,
      kwhClaim: 1n,
    })).toBe(1n);
  });

  it("rejects insufficient credit", () => {
    const bad = validateCredit({
      coinBalanceMicro: 1n,
      batchKwh: 1n,
      batchRedeemed: false,
      kwhClaim: 1n,
    });
    expect(bad.ok).toBe(false);
  });

  it("orchestrator plans atomic PTB (gate 5.5)", async () => {
    const orch = new SettlementOrchestrator();
    const plan = await orch.planRedemption({
      redemptionId: "rid-1",
      consumer: "0xabc",
      kwhClaim: 10n,
      coinBalanceMicro: 10_000_000n,
      batchKwh: 10n,
      batchRedeemed: false,
      billingPeriodEndMs: Date.now(),
    });
    expect(plan.ptbSteps.length).toBeLessThanOrEqual(10);
    expect(plan.gasBudgetMist).toBeGreaterThan(0n);
  });

  it("carbon bridge rejects grid source (gate 5.2.3)", () => {
    const bridge = new CarbonCreditBridge();
    expect(() => bridge.verifyRecEligibility(3, Date.now())).toThrow(/Ineligible/);
  });

  it("usdc settlement enforces stale price (gate 5.3.2)", () => {
    const usdc = new UsdcSettlementAdapter();
    expect(() =>
      usdc.assertFreshPrice({ price: 1n, publishTimeMs: Date.now() - 400_000 }),
    ).toThrow(/StalePrice/);
  });

  it("bridge watcher flags stalled VAAs", () => {
    const w = new BridgeWatcher();
    w.track("tx-1");
    const stalled = w.poll(Date.now() + 3_600_001);
    expect(stalled).toContain("tx-1");
  });
});

describe("SettlementService", () => {
  it("archives proof and orchestrates L4 ack (gates 4.8.3–4.8.4, 5.5)", async () => {
    const svc = new SettlementService();
    const result = await svc.process(
      {
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
      },
      { consumer: "0xconsumer", kwhClaim: 5n, coinBalanceMicro: 5_000_000n, batchKwh: 5n },
    );

    expect(result.acknowledged).toBe(true);
    expect(result.traceId).toBeDefined();
    expect(svc.auditStore.list().length).toBe(1);
  });
});
