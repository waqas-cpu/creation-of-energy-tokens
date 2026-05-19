import { describe, expect, it } from "vitest";
import { PipelineRunner } from "../src/pipelineRunner.js";
import { bindHandoff, defaultDisputeDeadline } from "../src/l3Handoff.js";
import type { ContractId } from "../src/types.js";

const CONTRACT = ("0x" + "bb".repeat(32)) as ContractId;

describe("PipelineRunner", () => {
  const runner = new PipelineRunner({
    engineAddress: "0x0000000000000000000000000000000000000001",
    chainId: 1,
    relayerAddress: "0x000000000000000000000000000000000000bEef",
    auth: { threshold: { m: 2, n: 3 } },
    submitMode: "simulation",
  });

  it("finalizes with mock L5 processor", async () => {
    const now = defaultDisputeDeadline(BigInt(Math.floor(Date.now() / 1000)));
    const request = bindHandoff(
      CONTRACT,
      [
        {
          token: "0x0000000000000000000000000000000000000002",
          partition: "0x" + "00".repeat(32),
          to: "0x0000000000000000000000000000000000000003",
          value: 100n,
          data: "0x",
          reversible: true,
        },
      ],
      {
        proof: "0x01",
        inputHash: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
        outputCommitment: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
      },
      ("0x" + "0".repeat(63) + "1") as `0x${string}`,
      "TRIGGERED",
      now,
      ["0x" + "11".repeat(65), "0x" + "22".repeat(65)],
    );

    const outcome = await runner.run(
      request,
      {
        process: async () => ({
          acknowledged: true,
          proofIds: ["0x" + "cc".repeat(32)],
          regulatoryReportCid: "0x" + "dd".repeat(32),
        }),
      },
      { estimatedGas: 200_000n, baseFee: 10_000_000_000n, priorityFee: 1_000_000_000n },
    );

    expect(outcome.status).toBe("FINALIZED");
    expect(outcome.result?.proofIds.length).toBe(1);
  });
});
