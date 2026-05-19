import { SETTLEMENT_EVENT_SCHEMA } from "./constants.js";

const REQUIRED_V1 = [
  "event_type",
  "redemption_id",
  "kwh",
  "consumer_addr",
  "producer_addr",
  "timestamp_ms",
  "block_height",
] as const;

/** Validates off-chain payloads against settlement_event_schema.yaml (T4). */
export function validateSettlementEventV1(
  payload: Record<string, unknown>,
): { readonly valid: boolean; readonly missing: readonly string[] } {
  if (payload.schema_version !== SETTLEMENT_EVENT_SCHEMA) {
    return { valid: false, missing: ["schema_version"] };
  }
  const missing = REQUIRED_V1.filter((k) => payload[k] === undefined);
  return { valid: missing.length === 0, missing };
}
