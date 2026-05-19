import { describe, expect, it } from "vitest";
import { createExecutionContext, ExecutionOrchestrator } from "../src/orchestrator.js";
import type { ContractId, ExecutionId } from "../src/types.js";

describe("ExecutionOrchestrator", () => {
  const engine = "0x0000000000000000000000000000000000000001" as const;
  const orchestrator = new ExecutionOrchestrator({ engineAddress: engine, chainId: 1 });

  it("prepares transaction through CTL/TXB lanes", async () => {
    const ctx = createExecutionContext({
      executionId: "0x" + "ab".repeat(32) as ExecutionId,
      contractId: "0x" + "cd".repeat(32) as ContractId,
      obligation: {
        token: "0x0000000000000000000000000000000000000002",
        partition: "0x" + "00".repeat(32),
        to: "0x0000000000000000000000000000000000000003",
        value: 1000n,
        data: "0x",
        reversible: true,
      },
    });

    const tx = await orchestrator.prepareExecution(ctx, 200_000n, 30_000_000_000n, 2_000_000_000n, 0);
    expect(tx.to).toBe(engine);
    expect(tx.value).toBe(0n);
    expect(tx.gasLimit).toBe(250_000n);
    expect(tx.type).toBe("eip1559");
    expect(orchestrator.getStatus()).toBe("AUTHORIZING");
  });

  it("blocks duplicate in-flight execution", async () => {
    const id = "0x" + "ef".repeat(32) as ExecutionId;
    const ctx = createExecutionContext({
      executionId: id,
      contractId: "0x" + "11".repeat(32) as ContractId,
      obligation: {
        token: "0x0000000000000000000000000000000000000002",
        partition: "0x" + "00".repeat(32),
        to: "0x0000000000000000000000000000000000000003",
        value: 1n,
        data: "0x",
        reversible: false,
      },
    });

    await orchestrator.prepareExecution(ctx, 100_000n, 10_000_000_000n, 1_000_000_000n, 1);
    orchestrator.markSubmitted(id, "0x" + "22".repeat(32));

    await expect(
      orchestrator.prepareExecution(ctx, 100_000n, 10_000_000_000n, 1_000_000_000n, 2),
    ).rejects.toThrow(/in flight/);
  });
});
