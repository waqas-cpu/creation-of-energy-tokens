import { PipelineRunner, type PipelineRunnerConfig } from "@sui-energy/layer4-engine";
import { SettlementService } from "@sui-energy/layer5-settlement";
import { L3ContractEngine } from "./l3ContractEngine.js";
import type { ContractId, Obligation } from "@sui-energy/layer4-engine";
import { planSuiRedemptionAfterL4 } from "./suiRedemptionHook.js";

export interface FullPipelineConfig extends PipelineRunnerConfig {
  readonly contractId: ContractId;
}

export interface FullPipelineResult {
  readonly l3State: string;
  readonly l4Status: string;
  readonly auditCount: number;
  readonly txHash?: string;
  readonly suiRedemptionDigest?: string;
}

/**
 * End-to-end: L3 FSM → L4 execution lanes → L5 settlement & audit.
 */
export async function runFullPipeline(
  config: FullPipelineConfig,
  obligation: Obligation,
): Promise<FullPipelineResult> {
  const l3 = new L3ContractEngine();
  l3.trigger();

  const oracleHash = ("0x" + "0".repeat(63) + "1") as `0x${string}`;
  const request = l3.buildExecutionRequest({
    contractId: config.contractId,
    obligations: [obligation],
    zkProof: {
      proof: "0x01",
      inputHash: oracleHash,
      outputCommitment: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
    },
    oracleSnapshotHash: oracleHash,
    signatures: [
      ("0x" + "11".repeat(65)) as `0x${string}`,
      ("0x" + "22".repeat(65)) as `0x${string}`,
    ],
  });

  const l5 = new SettlementService();
  const runner = new PipelineRunner(config);

  const outcome = await runner.run(
    request,
    l5,
    {
      estimatedGas: 350_000n,
      baseFee: 30_000_000_000n,
      priorityFee: 2_000_000_000n,
    },
  );

  if (outcome.status === "FINALIZED") {
    l3.onExecutionSuccess();
  } else if (outcome.failure) {
    l3.onExecutionFailure(outcome.failure.suggestedL3State);
  }

  let suiRedemptionDigest: string | undefined;
  if (outcome.status === "FINALIZED" && outcome.result) {
    const suiPlan = await planSuiRedemptionAfterL4(outcome.result, {
      packageId: "0x0",
      consumer: "0xconsumer",
      kwhClaim: 1n,
    });
    suiRedemptionDigest = suiPlan.digest;
  }

  return {
    l3State: l3.getState(),
    l4Status: outcome.status,
    auditCount: l5.auditStore.list().length,
    txHash: outcome.result?.txHash,
    suiRedemptionDigest,
  };
}
