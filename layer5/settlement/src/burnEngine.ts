import { KWH_SCALE } from "./constants.js";

export interface BurnEvent {
  readonly amount: bigint;
  readonly redemptionId: string;
  readonly consumer: string;
  readonly timestampMs: number;
}

/** Module 5.3 — burn engine audit log (on-chain burn via Move PTB). */
export class BurnEngine {
  private readonly burns: BurnEvent[] = [];

  recordBurn(event: BurnEvent): void {
    this.burns.push(event);
  }

  assertBurnAmount(kwhClaim: bigint, burnAmount: bigint): void {
    const expected = kwhClaim * KWH_SCALE;
    if (burnAmount !== expected) {
      throw new Error(`burn amount mismatch: expected ${expected} got ${burnAmount}`);
    }
  }

  history(limit = 100): readonly BurnEvent[] {
    return this.burns.slice(-limit);
  }
}
