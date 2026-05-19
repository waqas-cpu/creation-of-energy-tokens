import { describe, expect, it } from "vitest";
import { WormholeBridgeClient } from "../src/adapters/wormholeBridgeClient.js";
import { CircleOfframpClient } from "../src/adapters/circleOfframpClient.js";
import { validateSettlementEventV1 } from "../src/eventSchemaValidator.js";
import { SuiPtbClient } from "../src/suiPtbClient.js";

describe("Layer 5 adapters and schema", () => {
  it("wormhole client tracks VAA sequence (gate 5.2.5)", () => {
    const w = new WormholeBridgeClient();
    w.publishMessage(new Uint8Array([1, 2, 3]));
    const stale = w.checkVaaSequence(1);
    expect(stale.stale).toBe(true);
    const ok = w.checkVaaSequence(2);
    expect(ok.stale).toBe(false);
  });

  it("circle offramp enforces fee cap (gate 5.8)", () => {
    const c = new CircleOfframpClient();
    const q = c.quote(1_000_000n, 500n);
    expect(q.payout).toBeLessThan(q.usdcIn);
  });

  it("validates settlement event schema v1 (T4)", () => {
    const r = validateSettlementEventV1({
      schema_version: "v1.0.0",
      event_type: "BURN",
      redemption_id: "r1",
      kwh: 1n,
      consumer_addr: "0x1",
      producer_addr: "0x2",
      timestamp_ms: 1,
      block_height: 0,
    });
    expect(r.valid).toBe(true);
  });

  it("sui PTB client dry-runs (gate 5.5-B)", async () => {
    const client = new SuiPtbClient({ packageId: "0xpkg", network: "localnet" });
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
