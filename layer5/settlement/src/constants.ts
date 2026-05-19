/** Layer 5 integration gates — shared constants (RULE GLOBAL-5). */
export const KWH_SCALE = 1_000_000n;
export const BPS_DENOM = 10_000n;
export const PRICE_STALE_MS = 300_000;
export const DEFAULT_SLIPPAGE_BPS = 50;
export const BRIDGE_TIMELOCK_MS = 86_400_000;
export const SETTLEMENT_EVENT_SCHEMA = "v1.0.0" as const;
/** Placeholder CID / signature when settlement is skipped or reporting fails. */
export const ZERO_HEX_32 = ("0x" + "0".repeat(64)) as `0x${string}`;
export const MAX_PTB_MOVE_CALLS = 10;
export const GAS_PER_STEP_MIST = 2_000_000n;
export const GAS_BUFFER_BPS = 2000n;

export const L5_ERROR = {
  INSUFFICIENT_BALANCE: 501,
  ALREADY_REDEEMED: 502,
  METER_NOT_CERTIFIED: 503,
  INELIGIBLE_SOURCE: 504,
  UNREGISTERED_DESTINATION: 505,
  STALE_PRICE: 506,
  SLIPPAGE_EXCEEDED: 507,
  INSUFFICIENT_LIQUIDITY: 508,
  JURISDICTION_MISMATCH: 509,
} as const;
