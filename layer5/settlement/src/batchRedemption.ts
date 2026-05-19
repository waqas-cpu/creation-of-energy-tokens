export interface RedemptionEvent {
  readonly redemptionId: string;
  readonly batchId: string;
  readonly kwh: bigint;
  readonly consumer: string;
  readonly timestampMs: number;
}

/** Module 5.2 — batch redemption tracker (off-chain index). */
export class BatchRedemptionTracker {
  private readonly redeemed = new Map<string, RedemptionEvent>();
  private readonly usedIds = new Set<string>();

  registerIdempotency(redemptionId: string): void {
    if (this.usedIds.has(redemptionId)) {
      throw new Error(`duplicate redemption_id: ${redemptionId}`);
    }
    this.usedIds.add(redemptionId);
  }

  markRedeemed(event: RedemptionEvent): void {
    if (this.redeemed.has(event.batchId)) {
      throw new Error(`batch already redeemed: ${event.batchId}`);
    }
    this.registerIdempotency(event.redemptionId);
    this.redeemed.set(event.batchId, event);
  }

  isRedeemed(batchId: string): boolean {
    return this.redeemed.has(batchId);
  }

  history(limit = 50): readonly RedemptionEvent[] {
    return [...this.redeemed.values()].slice(-limit);
  }
}
