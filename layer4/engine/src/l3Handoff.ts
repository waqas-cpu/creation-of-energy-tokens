import { encodeAbiParameters, encodePacked, keccak256, parseAbiParameters } from "viem";
import type {
  ContractId,
  ExecutionId,
  ExecutionRequest,
  FailureReport,
  LifecycleState,
  Obligation,
  ZKProof,
} from "./types.js";
import { DISPUTE_WINDOW_SECONDS } from "./types.js";

export function computeExecutionId(
  contractId: ContractId,
  obligationHash: `0x${string}`,
  nonce: bigint,
): ExecutionId {
  return keccak256(
    encodePacked(["bytes32", "bytes32", "uint256"], [contractId, obligationHash, nonce]),
  ) as ExecutionId;
}

/** Matches Solidity `keccak256(abi.encode(obligations))` in ExecutionEngine */
export function computeObligationHash(obligations: readonly Obligation[]): `0x${string}` {
  const tuples = obligations.map(
    (o) => [o.token, o.partition, o.to, o.value, o.data, o.reversible] as const,
  );
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("(address, bytes32, address, uint256, bytes, bool)[]"),
      [tuples],
    ),
  ) as `0x${string}`;
}

/** Gate 4.0.1 — state must be TRIGGERED or ARBITRATION_RESOLVED */
export function validateL3Request(
  request: ExecutionRequest,
  nowSec: bigint,
): FailureReport | null {
  /** Pre-execution failures are keyed by contract until an execution id exists. */
  const execRef = request.contractId as unknown as ExecutionId;
  if (request.currentState !== "TRIGGERED" && request.currentState !== "ARBITRATION_RESOLVED") {
    return failure(execRef, "CTL", 4001, false, "MONITORING", "invalid FSM state");
  }
  if (request.zkProof.proof === "0x" || request.zkProof.proof.length <= 2) {
    return failure(execRef, "CTL", 4010, true, "MONITORING", "missing ZK proof");
  }
  if (request.activeChallenge) {
    return failure(execRef, "CTL", 4021, false, "DISPUTING", "active challenge");
  }
  if (nowSec < request.disputeDeadline) {
    return failure(execRef, "AUTH", 1103, true, "MONITORING", "dispute window open");
  }
  const hash = computeObligationHash(request.obligations);
  if (hash !== request.obligationHash) {
    return failure(execRef, "CTL", 4042, false, "ARBITRATION", "obligation hash mismatch");
  }
  return null;
}

export function bindHandoff(
  contractId: ContractId,
  obligations: readonly Obligation[],
  zkProof: ZKProof,
  oracleSnapshotHash: `0x${string}`,
  state: LifecycleState,
  disputeDeadline: bigint,
  signatures: readonly `0x${string}`[],
): ExecutionRequest {
  const obligationHash = computeObligationHash(obligations);
  return {
    contractId,
    currentState: state,
    obligationHash,
    oracleSnapshotHash,
    zkProof,
    disputeDeadline,
    activeChallenge: false,
    obligations,
    eip712Signatures: signatures,
  };
}

function failure(
  executionId: ExecutionId,
  lane: FailureReport["lane"],
  errorCode: number,
  recoverable: boolean,
  suggestedL3State: FailureReport["suggestedL3State"],
  message: string,
): FailureReport {
  return { executionId, lane, errorCode, recoverable, suggestedL3State, message };
}

export function defaultDisputeDeadline(nowSec: bigint): bigint {
  return nowSec - DISPUTE_WINDOW_SECONDS - 1n;
}
