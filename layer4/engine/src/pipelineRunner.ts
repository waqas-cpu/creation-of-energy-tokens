import type { Hash } from "viem";
import { AuthError, AuthGateway, type AuthGatewayConfig } from "./authGateway.js";
import { SafeAuthGateway, type SafeAuthGatewayConfig } from "./safeAuth.js";
import { CircuitBreaker } from "./circuitBreaker.js";
import { createTracker, updateConfirmation, type ConfirmationTracker } from "./confirmationTracker.js";
import { enrichWithGas } from "./gasEstimator.js";
import { IdempotencyGuard } from "./idempotencyGuard.js";
import { computeExecutionId, validateL3Request } from "./l3Handoff.js";
import { NonceManager } from "./nonceManager.js";
import { NetworkSubmitter, type SubmitMode } from "./networkSubmitter.js";
import { buildExecuteBatchTx } from "./transactionBuilder.js";
import {
  buildExecuteBatchViaSafeCalldata,
  type SafeExecutorConfig,
} from "./safeExecutor.js";
import {
  CONFIRMATION_DEPTH,
  type ContractId,
  type ExecutionContext,
  type ExecutionId,
  type ExecutionLaneStatus,
  type ExecutionRequest,
  type ExecutionResult,
  type FailureReport,
  type Lane,
  type LaneState,
  type Obligation,
} from "./types.js";

export interface PipelineRunnerConfig {
  readonly engineAddress: `0x${string}`;
  readonly chainId: number;
  readonly relayerAddress: `0x${string}`;
  /** Basic M-of-N count check (tests / simulation) */
  readonly auth?: AuthGatewayConfig;
  /** Safe + EIP-712 verification (production / Anvil E2E) */
  readonly safeAuth?: SafeAuthGatewayConfig;
  readonly submitMode: SubmitMode;
  /** Required when submitMode is `live` or `safe` */
  readonly walletClient?: import("viem").WalletClient;
  /** Required when submitMode is `safe` (gate 4.6.5) */
  readonly safeExecutor?: SafeExecutorConfig;
}

export interface L5Processor {
  process(result: ExecutionResult): Promise<{
    acknowledged: boolean;
    proofIds: readonly `0x${string}`[];
    regulatoryReportCid: `0x${string}`;
  }>;
}

export interface PipelineRunOutcome {
  readonly status: "FINALIZED" | "FAILED" | "ROLLED_BACK";
  readonly executionId: ExecutionId;
  readonly result?: ExecutionResult;
  readonly failure?: FailureReport;
  readonly laneStates: Readonly<Record<Lane, LaneState>>;
}

/**
 * Full L4 pipeline: CTL → TXB → AUTH → NET → FIN → L5 ack (horizontal decomp §3.1).
 */
export class PipelineRunner {
  private status: ExecutionLaneStatus = "IDLE";
  private readonly guard = new IdempotencyGuard();
  private readonly breaker = new CircuitBreaker();
  private readonly auth?: AuthGateway;
  private readonly safeAuth?: SafeAuthGateway;
  private readonly nonces: NonceManager;
  private readonly submitter: NetworkSubmitter;
  private readonly laneStates: Record<Lane, LaneState> = {
    CTL: "IDLE",
    TXB: "IDLE",
    AUTH: "IDLE",
    NET: "IDLE",
    FIN: "IDLE",
    SFT: "IDLE",
  };

  constructor(private readonly config: PipelineRunnerConfig) {
    if (config.safeAuth) {
      this.safeAuth = new SafeAuthGateway(config.safeAuth);
    } else if (config.auth) {
      this.auth = new AuthGateway(config.auth);
    } else {
      throw new Error("Layer4: auth or safeAuth config required");
    }
    this.nonces = new NonceManager();
    const netMode = config.submitMode === "safe" ? "live" : config.submitMode;
    this.submitter = new NetworkSubmitter(
      netMode,
      config.safeAuth?.publicClient,
      config.walletClient,
    );
  }

  getStatus(): ExecutionLaneStatus {
    return this.status;
  }

  getLaneStates(): Readonly<Record<Lane, LaneState>> {
    return { ...this.laneStates };
  }

  async run(
    request: ExecutionRequest,
    l5: L5Processor,
    gas: { estimatedGas: bigint; baseFee: bigint; priorityFee: bigint },
  ): Promise<PipelineRunOutcome> {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const executionId = computeExecutionId(
      request.contractId,
      request.obligationHash,
      0n,
    );

    try {
      this.breaker.assertClosed();
      this.laneStates.SFT = "RUNNING";
      this.guard.assertNotInFlight(executionId);

      const validationError = validateL3Request(request, nowSec);
      if (validationError) {
        return this.fail(validationError);
      }

      this.laneStates.CTL = "COMPLETED";
      this.status = "PREPARING";

      if (this.safeAuth) {
        await this.safeAuth.validate(request, executionId);
      } else {
        this.auth!.validate(request, executionId);
      }
      this.laneStates.AUTH = "COMPLETED";
      this.status = "AUTHORIZING";

      const obligation = request.obligations[0];
      if (!obligation) {
        throw new Error("Layer4: no obligations");
      }

      const ctx: ExecutionContext = {
        executionId,
        contractId: request.contractId,
        request,
        obligation,
        createdAt: Date.now(),
        deadline: Date.now() + 86_400_000,
        laneStates: { ...this.laneStates },
      };

      const nonce =
        (this.config.submitMode === "live" || this.config.submitMode === "safe") &&
        this.config.safeAuth
          ? await this.nonces.nextFromChain(
              this.config.safeAuth.publicClient,
              this.config.relayerAddress,
            )
          : this.nonces.next(this.config.relayerAddress);
      let tx;
      if (this.config.submitMode === "safe") {
        if (!this.config.safeExecutor) {
          throw new Error("Layer4: safeExecutor config required for safe submit mode");
        }
        const data = buildExecuteBatchViaSafeCalldata(
          request.contractId,
          request,
          executionId,
        );
        tx = enrichWithGas(
          {
            to: this.config.safeExecutor.executionModuleAddress,
            value: 0n,
            data,
            gasLimit: 0n,
            maxFeePerGas: 0n,
            maxPriorityFeePerGas: 0n,
            nonce,
            chainId: this.config.chainId,
            type: "eip1559",
          },
          gas.estimatedGas,
          gas.baseFee,
          gas.priorityFee,
          { baseFeeMultiplier: 125n, priorityFee: 1_000_000_000n, maxFeePerGasCap: 500_000_000_000n },
        );
      } else {
        const built = buildExecuteBatchTx({
          engineAddress: this.config.engineAddress,
          chainId: this.config.chainId,
          contractId: request.contractId,
          request,
          batchId: executionId,
          nonce,
        });

        if (!built.ok) {
          return this.fail({
            executionId,
            lane: "TXB",
            errorCode: 1000,
            recoverable: true,
            suggestedL3State: "MONITORING",
            message: built.message,
          });
        }

        tx = enrichWithGas(
          built.value,
          gas.estimatedGas,
          gas.baseFee,
          gas.priorityFee,
          { baseFeeMultiplier: 125n, priorityFee: 1_000_000_000n, maxFeePerGasCap: 500_000_000_000n },
        );
      }

      this.laneStates.TXB = "COMPLETED";
      this.guard.record(executionId, "QUEUED");
      this.status = "SUBMITTING";

      const { txHash, submittedAtBlock } = await this.submitter.submitWithRetry(tx);
      this.guard.record(executionId, "SUBMITTED", txHash);
      this.laneStates.NET = "COMPLETED";
      this.status = "CONFIRMING";

      if (this.config.submitMode === "live" || this.config.submitMode === "safe") {
        const client = this.config.safeAuth?.publicClient;
        if (client) {
          const receipt = await client.waitForTransactionReceipt({ hash: txHash });
          if (receipt.status !== "success") {
            return this.fail({
              executionId,
              lane: "NET",
              errorCode: 1201,
              recoverable: true,
              suggestedL3State: "MONITORING",
              message: `tx reverted: ${txHash}`,
            });
          }
        }
      }

      const fin = await this.awaitConfirmations(txHash, submittedAtBlock);
      if (fin.status !== "confirmed") {
        return this.fail({
          executionId,
          lane: "FIN",
          errorCode: fin.status === "reverted" ? 1201 : 1200,
          recoverable: fin.status === "stuck",
          suggestedL3State: "ARBITRATION",
          message: `finality: ${fin.status}`,
        });
      }

      this.laneStates.FIN = "COMPLETED";
      this.status = "AWAITING_L5";

      const executionBlock = submittedAtBlock;
      const confirmationBlock = submittedAtBlock + CONFIRMATION_DEPTH;
      const partialResult: ExecutionResult = {
        contractId: request.contractId,
        executionId,
        txHash,
        executionBlock,
        confirmationBlock,
        settled: true,
        rollbackReason: ("0x" + "0".repeat(64)) as `0x${string}`,
        proofIds: [],
        regulatoryReportCid: ("0x" + "0".repeat(64)) as `0x${string}`,
        gasUsed: gas.estimatedGas,
      };

      const l5Out = await l5.process(partialResult);
      if (!l5Out.acknowledged) {
        return this.fail({
          executionId,
          lane: "FIN",
          errorCode: 1200,
          recoverable: true,
          suggestedL3State: "MONITORING",
          message: "L5 did not acknowledge",
        });
      }

      const result: ExecutionResult = {
        ...partialResult,
        proofIds: l5Out.proofIds,
        regulatoryReportCid: l5Out.regulatoryReportCid,
      };

      this.guard.record(executionId, "FINALIZED", txHash);
      this.status = "FINALIZED";
      this.breaker.recordAttempt(true);

      return {
        status: "FINALIZED",
        executionId,
        result,
        laneStates: { ...this.laneStates, SFT: "COMPLETED" },
      };
    } catch (e) {
      this.breaker.recordAttempt(false);
      if (e instanceof AuthError) {
        return this.fail({
          executionId: e.executionId,
          lane: "AUTH",
          errorCode: e.code,
          recoverable: e.code === 1103 || e.code === 1105,
          suggestedL3State: e.code === 1103 ? "MONITORING" : "DISPUTING",
          message: e.message,
        });
      }
      const message = e instanceof Error ? e.message : String(e);
      return this.fail({
        executionId,
        lane: "CTL",
        errorCode: 0,
        recoverable: false,
        suggestedL3State: "DISPUTING",
        message,
      });
    }
  }

  private async awaitConfirmations(
    txHash: Hash,
    submittedAtBlock: number,
  ): Promise<ConfirmationTracker> {
    let tracker = createTracker(txHash, submittedAtBlock);
    for (let block = submittedAtBlock; block < submittedAtBlock + CONFIRMATION_DEPTH + 1; block++) {
      tracker = updateConfirmation(tracker, block, {
        blockNumber: BigInt(submittedAtBlock),
        status: "success",
      });
      if (tracker.status === "confirmed") {
        return tracker;
      }
    }
    return tracker;
  }

  private fail(report: FailureReport): PipelineRunOutcome {
    this.status = "FAILED";
    this.laneStates.CTL = "FAILED";
    return {
      status: "FAILED",
      executionId: report.executionId,
      failure: report,
      laneStates: { ...this.laneStates },
    };
  }
}

export function createContextFromRequest(
  request: ExecutionRequest,
  executionId: ExecutionId,
): ExecutionContext {
  const obligation = request.obligations[0]!;
  return {
    executionId,
    contractId: request.contractId,
    request,
    obligation,
    createdAt: Date.now(),
    deadline: Date.now() + 86_400_000,
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
