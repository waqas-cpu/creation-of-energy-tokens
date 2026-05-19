import { encodeFunctionData, type Abi, type Address, type Hex } from "viem";
import type { ExecutionRequest, Obligation, TransactionRequest } from "./types.js";

export type BuildErrorCode =
  | "ERR_TB_INVALID_CALLDATA"
  | "ERR_TB_CHAIN_ID_MISMATCH"
  | "ERR_UNEXPECTED_VALUE";

export type BuildResult =
  | { ok: true; value: TransactionRequest }
  | { ok: false; code: BuildErrorCode; message: string };

const EXECUTION_ENGINE_ABI = [
  {
    name: "executeBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "contractId", type: "bytes32" },
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "contractId", type: "bytes32" },
          { name: "currentState", type: "uint8" },
          { name: "obligationHash", type: "bytes32" },
          { name: "oracleSnapshotHash", type: "bytes32" },
          {
            name: "zkProof",
            type: "tuple",
            components: [
              { name: "proof", type: "bytes" },
              { name: "inputHash", type: "bytes32" },
              { name: "outputCommitment", type: "bytes32" },
            ],
          },
          { name: "disputeDeadline", type: "uint256" },
          { name: "activeChallenge", type: "bool" },
          {
            name: "obligations",
            type: "tuple[]",
            components: [
              { name: "token", type: "address" },
              { name: "partition", type: "bytes32" },
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "data", type: "bytes" },
              { name: "reversible", type: "bool" },
            ],
          },
        ],
      },
      { name: "batchId", type: "bytes32" },
    ],
    outputs: [{ name: "totalValue", type: "uint256" }],
  },
] as const satisfies Abi;

function lifecycleToUint8(state: ExecutionRequest["currentState"]): number {
  return state === "TRIGGERED" ? 2 : 5;
}

function mapObligation(o: Obligation) {
  return {
    token: o.token,
    partition: o.partition,
    to: o.to,
    value: o.value,
    data: o.data,
    reversible: o.reversible,
  };
}

/** Gate 4.5.1 — viem encodeFunctionData with full ABI (RULE-TS4-03) */
export function buildExecuteBatchTx(params: {
  engineAddress: Address;
  chainId: number;
  contractId?: Hex;
  request: ExecutionRequest;
  batchId: Hex;
  nonce: number;
}): BuildResult {
  if (params.chainId <= 0) {
    return { ok: false, code: "ERR_TB_CHAIN_ID_MISMATCH", message: "invalid chainId" };
  }

  const contractId = params.contractId ?? params.request.contractId;

  const data = encodeFunctionData({
    abi: EXECUTION_ENGINE_ABI,
    functionName: "executeBatch",
    args: [
      contractId,
      {
        contractId: params.request.contractId,
        currentState: lifecycleToUint8(params.request.currentState),
        obligationHash: params.request.obligationHash,
        oracleSnapshotHash: params.request.oracleSnapshotHash,
        zkProof: {
          proof: params.request.zkProof.proof,
          inputHash: params.request.zkProof.inputHash,
          outputCommitment: params.request.zkProof.outputCommitment,
        },
        disputeDeadline: params.request.disputeDeadline,
        activeChallenge: params.request.activeChallenge,
        obligations: params.request.obligations.map(mapObligation),
      },
      params.batchId,
    ],
  });

  const tx: TransactionRequest = {
    to: params.engineAddress,
    value: 0n,
    data,
    gasLimit: 0n,
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
    nonce: params.nonce,
    chainId: params.chainId,
    type: "eip1559",
  };

  return { ok: true, value: tx };
}

/** @deprecated Use buildExecuteBatchTx with full ExecutionRequest */
export function buildExecuteBatchTxLegacy(params: {
  engineAddress: Address;
  chainId: number;
  contractId: Hex;
  batchId: Hex;
  obligation: Obligation;
  nonce: number;
}): BuildResult {
  return buildExecuteBatchTx({
    ...params,
    request: {
      contractId: params.contractId as ExecutionRequest["contractId"],
      currentState: "TRIGGERED",
      obligationHash: ("0x" + "0".repeat(64)) as Hex,
      oracleSnapshotHash: ("0x" + "0".repeat(63) + "1") as Hex,
      zkProof: {
        proof: "0x01",
        inputHash: ("0x" + "0".repeat(63) + "1") as Hex,
        outputCommitment: ("0x" + "0".repeat(63) + "1") as Hex,
      },
      disputeDeadline: 0n,
      activeChallenge: false,
      obligations: [params.obligation],
      eip712Signatures: [("0x" + "11".repeat(65)) as `0x${string}`],
    },
  });
}
