import { describe, expect, it } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import { buildLayer5RedeemPtb, redemptionIdBytes } from "../src/buildRedeemPtb.js";
import { SuiPtbClient } from "../src/suiPtbClient.js";

const STUB_OBJECTS = {
  treasuryGuardId: "0x1",
  energyBatchId: "0x2",
  energyCoinId: "0x3",
  energyMeterId: "0x4",
  complianceRegistryId: "0x5",
  jurisdictionPolicyId: "0x6",
  redemptionRegistryId: "0x7",
  gridOperatorCapId: "0x8",
  billingOperatorCapId: "0x9",
  gridSettlementLedgerId: "0xa",
};

describe("buildLayer5RedeemPtb", () => {
  it("builds redeem_atomic move call target", () => {
    const l5 = "0x00000000000000000000000000000000000000000000000000000000000000a5";
    const client = new SuiPtbClient({
      packageId: l5,
      network: "localnet",
      stub: true,
      objects: STUB_OBJECTS,
    });
    const steps = client.buildRedeemPtbSteps({
      redemptionId: "r",
      consumer: "0xc",
      kwhClaim: 1n,
      coinBalanceMicro: 1_000_000n,
      batchKwh: 1n,
      batchRedeemed: false,
      billingPeriodEndMs: Date.now(),
    });
    expect(steps[0]).toBe(`${l5}::redemption_orchestrator::redeem_atomic`);
    expect(() =>
      buildLayer5RedeemPtb(new Transaction(), { l5PackageId: l5, l3GridPackageId: l5 }, STUB_OBJECTS, {
        redemptionId: redemptionIdBytes("abcd"),
        kwh: 2n,
        billingPeriodEndMs: 1_700_000_000_000n,
        billingPeriodOverride: false,
        usdcEquiv: 0n,
      }),
    ).not.toThrow();
  });

  it("stub client dry-runs without RPC (gate 5.5-B)", async () => {
    const client = new SuiPtbClient({
      packageId: "0x0",
      network: "localnet",
      stub: true,
      objects: STUB_OBJECTS,
    });
    const dry = await client.dryRun({
      redemptionId: "r",
      consumer: "0xc",
      kwhClaim: 1n,
      coinBalanceMicro: 1_000_000n,
      batchKwh: 1n,
      batchRedeemed: false,
      billingPeriodEndMs: Date.now(),
    });
    expect(dry.success).toBe(true);
  });
});
