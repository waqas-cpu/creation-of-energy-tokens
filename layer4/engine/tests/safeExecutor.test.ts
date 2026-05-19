import { describe, expect, it } from "vitest";
import { buildExecuteBatchViaSafeCalldata } from "../src/safeExecutor.js";
import type { ContractId, ExecutionId } from "../src/types.js";

describe("safeExecutor", () => {
  it("encodes executeBatchViaSafe calldata", () => {
    const contractId = ("0x" + "aa".repeat(32)) as ContractId;
    const executionId = ("0x" + "bb".repeat(32)) as ExecutionId;
    const data = buildExecuteBatchViaSafeCalldata(
      contractId,
      {
        contractId,
        currentState: "TRIGGERED",
        obligationHash: ("0x" + "cc".repeat(32)) as `0x${string}`,
        oracleSnapshotHash: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
        zkProof: {
          proof: "0x01",
          inputHash: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
          outputCommitment: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
        },
        disputeDeadline: 1n,
        activeChallenge: false,
        obligations: [
          {
            token: "0x0000000000000000000000000000000000000001",
            partition: ("0x" + "00".repeat(32)) as `0x${string}`,
            to: "0x0000000000000000000000000000000000000002",
            value: 1n,
            data: "0x",
            reversible: true,
          },
        ],
        eip712Signatures: [],
      },
      executionId,
    );
    expect(data.startsWith("0x")).toBe(true);
    expect(data.length).toBeGreaterThan(10);
  });
});
