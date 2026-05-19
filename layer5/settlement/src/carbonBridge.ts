import { L5_ERROR } from "./constants.js";

const REC_ELIGIBLE_SOURCES = new Set([0, 1, 2]);
const TWELVE_MONTHS_MS = 31_536_000_000;

export interface BridgeQuote {
  readonly wormholeFeeUsdc: bigint;
  readonly registryFeeUsdc: bigint;
  readonly totalUsdc: bigint;
}

/** Module 5.7 — carbon credit bridge (RULE-5.7-A..E). */
export class CarbonCreditBridge {
  private readonly claims = new Map<string, { readonly registry: string; readonly creditId: string }>();

  verifyRecEligibility(source: number, batchTimestampMs: number, nowMs = Date.now()): void {
    if (!REC_ELIGIBLE_SOURCES.has(source)) {
      throw new Error(`EIneligibleSource (${L5_ERROR.INELIGIBLE_SOURCE})`);
    }
    if (nowMs - batchTimestampMs >= TWELVE_MONTHS_MS) {
      throw new Error("batch older than 12 months");
    }
  }

  quoteBridgeFees(): BridgeQuote {
    const wormhole = 5_000_000n;
    const registry = 10_000_000n;
    return { wormholeFeeUsdc: wormhole, registryFeeUsdc: registry, totalUsdc: wormhole + registry };
  }

  recordClaim(batchId: string, registry: string, creditId: string): void {
    if (this.claims.has(batchId)) {
      throw new Error(`carbon credit already claimed for batch ${batchId}`);
    }
    this.claims.set(batchId, { registry, creditId });
  }
}
