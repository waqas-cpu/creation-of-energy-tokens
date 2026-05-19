import type { GasStrategy, TransactionRequest } from "./types.js";
import { MAX_GAS_LIMIT } from "./types.js";

/** Gate 4.5.2 — estimatedGas * 1.25, cap 15M (integration gates) */
export function applyGasBuffer(estimatedGas: bigint, multiplier = 125n): bigint {
  const withBuffer = (estimatedGas * multiplier) / 100n;
  return withBuffer > MAX_GAS_LIMIT ? MAX_GAS_LIMIT : withBuffer;
}

/** Gate 4.5.3 — maxFeePerGas = baseFee * 2 + priorityFee */
export function computeEip1559Fees(
  baseFeePerGas: bigint,
  maxPriorityFeePerGas: bigint,
  strategy: GasStrategy,
): { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } {
  const priority =
    maxPriorityFeePerGas >= strategy.priorityFee ? maxPriorityFeePerGas : strategy.priorityFee;
  let maxFee = baseFeePerGas * 2n + priority;
  if (maxFee > strategy.maxFeePerGasCap) {
    maxFee = strategy.maxFeePerGasCap;
  }
  return { maxFeePerGas: maxFee, maxPriorityFeePerGas: priority };
}

export function enrichWithGas(
  tx: TransactionRequest,
  estimatedGas: bigint,
  baseFeePerGas: bigint,
  maxPriorityFeePerGas: bigint,
  strategy: GasStrategy,
): TransactionRequest {
  const fees = computeEip1559Fees(baseFeePerGas, maxPriorityFeePerGas, strategy);
  return {
    ...tx,
    gasLimit: applyGasBuffer(estimatedGas),
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  };
}
