import { describe, expect, it } from "vitest";
import { runFullPipeline } from "../src/runFullPipeline.js";
import { L3ContractEngine } from "../src/l3ContractEngine.js";
import { suiAttestationToExecutionRequest } from "../src/suiBridge.js";
import { PipelineRunner } from "@sui-energy/layer4-engine";
import { SettlementService } from "@sui-energy/layer5-settlement";

const ENGINE = "0x0000000000000000000000000000000000000001" as const;
const RELAYER = "0x000000000000000000000000000000000000bEef" as const;
const CONTRACT = ("0x" + "aa".repeat(32)) as import("@sui-energy/layer4-engine").ContractId;

const baseConfig = {
  engineAddress: ENGINE,
  chainId: 1,
  relayerAddress: RELAYER,
  auth: {
    threshold: { m: 2, n: 3 },
    authorizedSigners: [RELAYER],
  },
  submitMode: "simulation" as const,
  contractId: CONTRACT,
};

describe("full pipeline L3→L4→L5", () => {
  it("runs simulation from TRIGGERED to SETTLED with audit record", async () => {
    const result = await runFullPipeline(baseConfig, {
      token: "0x0000000000000000000000000000000000000002",
      partition: "0x" + "00".repeat(32),
      to: "0x0000000000000000000000000000000000000003",
      value: 1_000_000n,
      data: "0x",
      reversible: true,
    });

    expect(result.l3State).toBe("SETTLED");
    expect(result.l4Status).toBe("FINALIZED");
    expect(result.auditCount).toBe(1);
    expect(result.txHash).toMatch(/^0x/);
  });

  it("L3 rejects request when not TRIGGERED", () => {
    const l3 = new L3ContractEngine();
    expect(() =>
      l3.buildExecutionRequest({
        contractId: CONTRACT,
        obligations: [],
        zkProof: { proof: "0x01", inputHash: "0x" + "0".repeat(64), outputCommitment: "0x" + "0".repeat(64) },
        oracleSnapshotHash: "0x" + "0".repeat(64),
        signatures: ["0x" + "11".repeat(65), "0x" + "22".repeat(65)],
      }),
    ).toThrow(/cannot build request/);
  });

  it("Sui bridge produces valid execution request", () => {
    const req = suiAttestationToExecutionRequest(CONTRACT, {
      meterId: "meter-1",
      kwh: 1_000_000n,
      timestampMs: 1_000_000_000n,
      producerAddress: "0x0000000000000000000000000000000000000003",
      energyTokenAddress: "0x0000000000000000000000000000000000000002",
      oracleSnapshotHash: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
      secp256k1Sig: "0x" + "ab".repeat(64),
    }, ["0x" + "11".repeat(65), "0x" + "22".repeat(65)]);

    expect(req.obligations.length).toBe(1);
    expect(req.eip712Signatures.length).toBeGreaterThanOrEqual(2);
  });

  it("fails when dispute window still open", async () => {
    const l3 = new L3ContractEngine();
    l3.trigger();
    const now = BigInt(Math.floor(Date.now() / 1000));
    const request = l3.buildExecutionRequest({
      contractId: CONTRACT,
      obligations: [
        {
          token: "0x0000000000000000000000000000000000000002",
          partition: "0x" + "00".repeat(32),
          to: "0x0000000000000000000000000000000000000003",
          value: 1n,
          data: "0x",
          reversible: true,
        },
      ],
      zkProof: {
        proof: "0x01",
        inputHash: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
        outputCommitment: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
      },
      oracleSnapshotHash: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
      signatures: ["0x" + "11".repeat(65), "0x" + "22".repeat(65)],
      disputeDeadline: now + 86_400n,
    });

    const runner = new PipelineRunner(baseConfig);
    const outcome = await runner.run(request, new SettlementService(), {
      estimatedGas: 100_000n,
      baseFee: 10_000_000_000n,
      priorityFee: 1_000_000_000n,
    });

    expect(outcome.status).toBe("FAILED");
    expect(outcome.failure?.errorCode).toBe(1103);
  });
});
