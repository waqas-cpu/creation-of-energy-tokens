import { BPS_DENOM, DEFAULT_SLIPPAGE_BPS, L5_ERROR, PRICE_STALE_MS } from "./constants.js";

export interface PriceFeedSnapshot {
  readonly price: bigint;
  readonly publishTimeMs: number;
}

/** Module 5.8 — USDC settlement adapter (RULE-5.8-A..E). */
export class UsdcSettlementAdapter {
  private readonly escrows = new Map<string, { readonly amount: bigint; readonly expiresAt: number }>();

  assertFreshPrice(feed: PriceFeedSnapshot, nowMs = Date.now()): void {
    if (feed.publishTimeMs <= nowMs - PRICE_STALE_MS) {
      throw new Error(`EStalePrice (${L5_ERROR.STALE_PRICE})`);
    }
  }

  assertSlippage(
    energyMicro: bigint,
    usdcMicro: bigint,
    price: bigint,
    slippageBps = DEFAULT_SLIPPAGE_BPS,
  ): void {
    const expected = (energyMicro * price) / 1_000_000n;
    const min = (expected * (BPS_DENOM - BigInt(slippageBps))) / BPS_DENOM;
    const max = (expected * (BPS_DENOM + BigInt(slippageBps))) / BPS_DENOM;
    if (usdcMicro < min || usdcMicro > max) {
      throw new Error(`ESlippageExceeded (${L5_ERROR.SLIPPAGE_EXCEEDED})`);
    }
  }

  escrowUsdc(tradeId: string, amount: bigint, maxDurationMs = 86_400_000): void {
    this.escrows.set(tradeId, { amount, expiresAt: Date.now() + maxDurationMs });
  }

  releaseUsdc(tradeId: string): bigint {
    const row = this.escrows.get(tradeId);
    if (!row) throw new Error(`unknown trade ${tradeId}`);
    this.escrows.delete(tradeId);
    return row.amount;
  }

  payoutAfterFee(usdcAmount: bigint, platformFeeBps: bigint): { readonly payout: bigint; readonly fee: bigint } {
    const fee = (usdcAmount * platformFeeBps) / BPS_DENOM;
    return { payout: usdcAmount - fee, fee };
  }
}
