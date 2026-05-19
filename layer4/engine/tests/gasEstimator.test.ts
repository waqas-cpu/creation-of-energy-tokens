import { describe, expect, it } from "vitest";
import { applyGasBuffer, computeEip1559Fees } from "../src/gasEstimator.js";
import { DEFAULT_GAS_STRATEGY, MAX_GAS_LIMIT } from "../src/types.js";

describe("gasEstimator", () => {
  it("applies 25% buffer capped at 15M", () => {
    expect(applyGasBuffer(1_000_000n)).toBe(1_250_000n);
    expect(applyGasBuffer(20_000_000n)).toBe(MAX_GAS_LIMIT);
  });

  it("computes EIP-1559 fees per gate 4.5.3", () => {
    const { maxFeePerGas, maxPriorityFeePerGas } = computeEip1559Fees(
      50_000_000_000n,
      2_000_000_000n,
      DEFAULT_GAS_STRATEGY,
    );
    expect(maxPriorityFeePerGas).toBeGreaterThanOrEqual(1_000_000_000n);
    expect(maxFeePerGas).toBe(102_000_000_000n);
  });
});
