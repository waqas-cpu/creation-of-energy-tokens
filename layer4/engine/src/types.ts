/** Layer 4 types — horizontal decomp §2.1–2.2, integration gates §5 */

export type ExecutionId = `0x${string}` & { readonly __brand: "ExecutionId" };
export type ContractId = `0x${string}` & { readonly __brand: "ContractId" };

export type Lane = "CTL" | "TXB" | "AUTH" | "NET" | "FIN" | "SFT";

export type LaneState = "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";

export type ExecutionLaneStatus =
  | "IDLE"
  | "PREPARING"
  | "AUTHORIZING"
  | "SUBMITTING"
  | "MEMPOOL"
  | "CONFIRMING"
  | "AWAITING_L5"
  | "FINALIZED"
  | "ROLLED_BACK"
  | "FAILED";

export type LifecycleState = "TRIGGERED" | "ARBITRATION_RESOLVED";

export interface ZKProof {
  readonly proof: `0x${string}`;
  readonly inputHash: `0x${string}`;
  readonly outputCommitment: `0x${string}`;
}

export interface Obligation {
  readonly token: `0x${string}`;
  readonly partition: `0x${string}`;
  readonly to: `0x${string}`;
  readonly value: bigint;
  readonly data: `0x${string}`;
  readonly reversible: boolean;
}

/** L3 → L4 handoff (integration gates §5) */
export interface ExecutionRequest {
  readonly contractId: ContractId;
  readonly currentState: LifecycleState;
  readonly obligationHash: `0x${string}`;
  readonly oracleSnapshotHash: `0x${string}`;
  readonly zkProof: ZKProof;
  readonly disputeDeadline: bigint;
  readonly activeChallenge: boolean;
  readonly obligations: readonly Obligation[];
  readonly eip712Signatures: readonly `0x${string}`[];
}

/** L4 → L5 handoff (integration gates §5) */
export interface ExecutionResult {
  readonly contractId: ContractId;
  readonly executionId: ExecutionId;
  readonly txHash: `0x${string}`;
  readonly executionBlock: number;
  readonly confirmationBlock: number;
  readonly settled: boolean;
  readonly rollbackReason: `0x${string}`;
  readonly proofIds: readonly `0x${string}`[];
  readonly regulatoryReportCid: `0x${string}`;
  readonly gasUsed: bigint;
}

/** L4 → L3 failure propagation (horizontal decomp §4.6) */
export interface FailureReport {
  readonly executionId: ExecutionId;
  readonly lane: Lane;
  readonly errorCode: number;
  readonly recoverable: boolean;
  readonly suggestedL3State: "MONITORING" | "DISPUTING" | "ARBITRATION";
  readonly message: string;
}

export interface TransactionRequest {
  readonly to: `0x${string}`;
  readonly value: bigint;
  readonly data: `0x${string}`;
  readonly gasLimit: bigint;
  readonly maxFeePerGas: bigint;
  readonly maxPriorityFeePerGas: bigint;
  readonly nonce: number;
  readonly chainId: number;
  readonly type: "eip1559";
}

export interface ExecutionContext {
  readonly executionId: ExecutionId;
  readonly contractId: ContractId;
  readonly request: ExecutionRequest;
  readonly obligation: Obligation;
  readonly createdAt: number;
  readonly deadline: number;
  readonly laneStates: Readonly<Record<Lane, LaneState>>;
}

export interface GasStrategy {
  readonly baseFeeMultiplier: bigint;
  readonly priorityFee: bigint;
  readonly maxFeePerGasCap: bigint;
}

export const DEFAULT_GAS_STRATEGY: GasStrategy = {
  baseFeeMultiplier: 125n,
  priorityFee: 1_000_000_000n,
  maxFeePerGasCap: 500_000_000_000n,
};

export const CONFIRMATION_DEPTH = 12;
export const MAX_GAS_LIMIT = 15_000_000n;
export const MAX_RETRIES = 3;
export const DISPUTE_WINDOW_SECONDS = 86_400n;
