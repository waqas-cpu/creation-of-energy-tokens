import { SETTLEMENT_EVENT_SCHEMA } from "./constants.js";

export type SettlementEventType =
  | "BURN_PRECOMMIT"
  | "REDEMPTION"
  | "REC_BRIDGE"
  | "USDC_SETTLED"
  | "L4_EXECUTION_ACK";

export interface SettlementEventV1 {
  readonly schemaVersion: typeof SETTLEMENT_EVENT_SCHEMA;
  readonly eventType: SettlementEventType;
  readonly redemptionId: string;
  readonly kwh: bigint;
  readonly consumerAddr: string;
  readonly producerAddr: string;
  readonly oracleSig: `0x${string}`;
  readonly timestampMs: number;
  readonly blockHeight: number;
}

/** Module 5.4 — bridge & reporting adapter (RULE-5.4-C). */
export class BridgeReportingAdapter {
  private readonly buffer: SettlementEventV1[] = [];
  private readonly maxBuffer = 10_000;

  emit(event: SettlementEventV1): void {
    this.buffer.push(event);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }
  }

  query(sinceMs: number): readonly SettlementEventV1[] {
    return this.buffer.filter((e) => e.timestampMs >= sinceMs);
  }
}
