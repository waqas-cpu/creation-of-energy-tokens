import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  encodeFunctionData,
} from "viem";
import type { ContractId, ExecutionId, ExecutionRequest } from "./types.js";
import { readSafeNonce } from "./safeAuth.js";

const EXECUTION_MODULE_ABI = [
  {
    name: "executeBatchViaSafe",
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
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

export interface SafeExecutorConfig {
  readonly executionModuleAddress: Address;
  readonly safeAddress: Address;
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;
}

/** Gate 4.6.5 — relayer invokes module; module verifies ZK then `execTransactionFromModule` → engine */
export function buildExecuteBatchViaSafeCalldata(
  contractId: ContractId,
  request: ExecutionRequest,
  batchId: ExecutionId,
): Hex {
  return encodeFunctionData({
    abi: EXECUTION_MODULE_ABI,
    functionName: "executeBatchViaSafe",
    args: [
      contractId,
      {
        contractId: request.contractId,
        currentState: request.currentState === "TRIGGERED" ? 2 : 5,
        obligationHash: request.obligationHash,
        oracleSnapshotHash: request.oracleSnapshotHash,
        zkProof: {
          proof: request.zkProof.proof,
          inputHash: request.zkProof.inputHash,
          outputCommitment: request.zkProof.outputCommitment,
        },
        disputeDeadline: request.disputeDeadline,
        activeChallenge: request.activeChallenge,
        obligations: request.obligations.map((o) => ({
          token: o.token,
          partition: o.partition,
          to: o.to,
          value: o.value,
          data: o.data,
          reversible: o.reversible,
        })),
      },
      batchId,
    ],
  });
}

export async function readSafeTransactionNonce(config: SafeExecutorConfig): Promise<number> {
  return readSafeNonce(config.publicClient, config.safeAddress);
}
