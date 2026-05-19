import { KWH_SCALE, L5_ERROR } from "./constants.js";

export interface CreditValidationInput {
  readonly coinBalanceMicro: bigint;
  readonly batchKwh: bigint;
  readonly batchRedeemed: boolean;
  readonly kwhClaim: bigint;
}

export interface CreditValidationError {
  readonly code: "INSUFFICIENT_CREDIT";
  readonly required: bigint;
  readonly available: bigint;
}

export type CreditValidationResult =
  | { readonly ok: true; readonly maxCreditKwh: bigint }
  | { readonly ok: false; readonly error: CreditValidationError };

/** Module 5.1 — read-only credit validation (RULE-5.1-A..D). */
export function validateCredit(input: CreditValidationInput): CreditValidationResult {
  if (input.batchRedeemed) {
    return {
      ok: false,
      error: {
        code: "INSUFFICIENT_CREDIT",
        required: input.kwhClaim * KWH_SCALE,
        available: 0n,
      },
    };
  }
  const required = input.kwhClaim * KWH_SCALE;
  if (input.coinBalanceMicro < required || input.batchKwh !== input.kwhClaim) {
    return {
      ok: false,
      error: {
        code: "INSUFFICIENT_CREDIT",
        required,
        available: input.coinBalanceMicro,
      },
    };
  }
  const coinKwh = input.coinBalanceMicro / KWH_SCALE;
  const maxCreditKwh = coinKwh < input.batchKwh ? coinKwh : input.batchKwh;
  return { ok: true, maxCreditKwh };
}

export function assertCreditOrThrow(input: CreditValidationInput): bigint {
  const result = validateCredit(input);
  if (!result.ok) {
    throw new Error(
      `${result.error.code}: required=${result.error.required} available=${result.error.available} (L5 ${L5_ERROR.INSUFFICIENT_BALANCE})`,
    );
  }
  return result.maxCreditKwh;
}
