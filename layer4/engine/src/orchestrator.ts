import type { Address, Hex } from "viem";
import { createTracker, updateConfirmation } from "./confirmationTracker.js";
import { IdempotencyGuard } from "./idempotencyGuard.js";
import { enrichWithGas } from "./gasEstimator.js";
import { buildExecuteBatchTxLegacy } from "./transactionBuilder.js";
import {
  DEFAULT_GAS_STRATEGY,
  type ContractId,
  type ExecutionContext,
  type ExecutionId,
  type ExecutionLaneStatus,
  type Lane,
  type LaneState,
  type Obligation,
} from "./types.js";

export interface OrchestratorConfig {
  readonly engineAddress: Address;
  readonly chainId: number;
}

export class ExecutionOrchestrator {
  private status: ExecutionLaneStatus = "IDLE";
  private readonly guard = new IdempotencyGuard();
  private readonly laneStates: Record<Lane, LaneState> = {
    CTL: "IDLE",
    TXB: "IDLE",
    AUTH: "IDLE",
    NET: "IDLE",
    FIN: "IDLE",
    SFT: "IDLE",
  };

  constructor(private readonly config: OrchestratorConfig) {}

  getStatus(): ExecutionLaneStatus {
    return this.status;
  }

  getLaneStates(): Readonly<Record<Lane, LaneState>> {
    return this.laneStates;
  }

  /** Happy path: CTL → TXB → SFT guard (horizontal decomp §3.1) */
  async prepareExecution(
    ctx: ExecutionContext,
    estimatedGas: bigint,
    baseFeePerGas: bigint,
    maxPriorityFeePerGas: bigint,
    nonce: number,
  ) {
    this.status = "PREPARING";
    this.laneStates.CTL = "RUNNING";
    this.laneStates.SFT = "RUNNING";

    this.guard.assertNotInFlight(ctx.executionId);
    this.guard.record(ctx.executionId, "QUEUED");

    const built = buildExecuteBatchTxLegacy({
      engineAddress: this.config.engineAddress,
      chainId: this.config.chainId,
      contractId: ctx.contractId as `0x${string}`,
      batchId: ctx.executionId,
      obligation: ctx.obligation,
      nonce,
    });

    if (!built.ok) {
      this.status = "FAILED";
      this.laneStates.TXB = "FAILED";
      throw new Error(`${built.code}: ${built.message}`);
    }

    this.laneStates.TXB = "COMPLETED";
    const tx = enrichWithGas(
      built.value,
      estimatedGas,
      baseFeePerGas,
      maxPriorityFeePerGas,
      DEFAULT_GAS_STRATEGY,
    );

    this.laneStates.SFT = "COMPLETED";
    this.laneStates.CTL = "COMPLETED";
    this.status = "AUTHORIZING";
    return tx;
  }

  markSubmitted(executionId: ExecutionId, txHash: Hex) {
    this.guard.record(executionId, "SUBMITTED", txHash);
    this.status = "MEMPOOL";
    this.laneStates.NET = "COMPLETED";
  }

  trackConfirmations(
    executionId: ExecutionId,
    txHash: Hex,
    submittedAtBlock: number,
    currentBlock: number,
    receipt: { blockNumber: bigint; status: "success" | "reverted" } | null,
  ) {
    const tracker = createTracker(txHash, submittedAtBlock);
    const updated = updateConfirmation(tracker, currentBlock, receipt);
    if (updated.status === "confirmed") {
      this.guard.record(executionId, "FINALIZED", txHash);
      this.status = "FINALIZED";
      this.laneStates.FIN = "COMPLETED";
    } else if (updated.status === "reverted" || updated.status === "stuck") {
      this.status = "FAILED";
      this.laneStates.FIN = "FAILED";
    } else {
      this.guard.record(executionId, "CONFIRMING", txHash);
      this.status = "CONFIRMING";
    }
    return updated;
  }
}

export function createExecutionContext(params: {
  executionId: ExecutionId;
  contractId: ContractId;
  obligation: Obligation;
  request?: ExecutionContext["request"];
  deadlineMs?: number;
}): ExecutionContext {
  const now = Date.now();
  const request =
    params.request ??
    ({
      contractId: params.contractId,
      currentState: "TRIGGERED" as const,
      obligationHash: ("0x" + "0".repeat(64)) as `0x${string}`,
      oracleSnapshotHash: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
      zkProof: {
        proof: "0x01",
        inputHash: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
        outputCommitment: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
      },
      disputeDeadline: 0n,
      activeChallenge: false,
      obligations: [params.obligation],
      eip712Signatures: [("0x" + "11".repeat(65)) as `0x${string}`],
    } satisfies ExecutionContext["request"]);

  return {
    executionId: params.executionId,
    contractId: params.contractId,
    request,
    obligation: params.obligation,
    createdAt: now,
    deadline: now + (params.deadlineMs ?? 86_400_000),
    laneStates: {
      CTL: "IDLE",
      TXB: "IDLE",
      AUTH: "IDLE",
      NET: "IDLE",
      FIN: "IDLE",
      SFT: "IDLE",
    },
  };
}
