import {
  type Address,
  type Hex,
  type PublicClient,
  recoverTypedDataAddress,
} from "viem";
import type { ContractId, ExecutionId, ExecutionRequest } from "./types.js";
import { AuthError, type AuthGatewayConfig } from "./authGateway.js";

const SAFE_ABI = [
  {
    name: "getThreshold",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getOwners",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    name: "isOwner",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export const EXECUTION_AUTH_EIP712_TYPES = {
  ExecutionAuthorization: [
    { name: "contractId", type: "bytes32" },
    { name: "obligationHash", type: "bytes32" },
    { name: "executionId", type: "bytes32" },
  ],
} as const;

export const EXECUTION_AUTH_DOMAIN = {
  name: "SelfExecutingContract",
  version: "1",
} as const;

export interface SafeAuthGatewayConfig extends AuthGatewayConfig {
  readonly safeAddress: Address;
  readonly chainId: number;
  readonly verifyingContract: Address;
  readonly publicClient: PublicClient;
}

export function buildExecutionAuthMessage(
  contractId: ContractId,
  obligationHash: Hex,
  executionId: ExecutionId,
) {
  return {
    contractId,
    obligationHash,
    executionId,
  } as const;
}

/**
 * Lane AUTH — Safe M-of-N + EIP-712 (gates 4.6.1–4.6.3, horizontal decomp §2.3).
 */
export class SafeAuthGateway {
  constructor(private readonly config: SafeAuthGatewayConfig) {}

  async validate(request: ExecutionRequest, executionId: ExecutionId): Promise<void> {
    const sigs = request.eip712Signatures;
    if (request.zkProof.proof.length <= 2) {
      throw new AuthError(1102, "ZK proof invalid", executionId);
    }

    const { publicClient, safeAddress } = this.config;
    const threshold = await publicClient.readContract({
      address: safeAddress,
      abi: SAFE_ABI,
      functionName: "getThreshold",
    });

    if (sigs.length < Number(threshold)) {
      throw new AuthError(
        1105,
        `threshold not met: ${sigs.length}/${threshold}`,
        executionId,
      );
    }

    const owners = await publicClient.readContract({
      address: safeAddress,
      abi: SAFE_ABI,
      functionName: "getOwners",
    });
    const ownerSet = new Set(owners.map((o) => o.toLowerCase()));

    const domain = {
      ...EXECUTION_AUTH_DOMAIN,
      chainId: this.config.chainId,
      verifyingContract: this.config.verifyingContract,
    };

    const message = buildExecutionAuthMessage(
      request.contractId,
      request.obligationHash,
      executionId,
    );

    const recovered = new Set<string>();
    for (const sig of sigs) {
      const signer = await recoverTypedDataAddress({
        domain,
        types: EXECUTION_AUTH_EIP712_TYPES,
        primaryType: "ExecutionAuthorization",
        message,
        signature: sig,
      });
      const key = signer.toLowerCase();
      if (!ownerSet.has(key)) {
        throw new AuthError(1101, `signer not in Safe owners: ${signer}`, executionId);
      }
      if (recovered.has(key)) {
        throw new AuthError(1101, "duplicate signer", executionId);
      }
      recovered.add(key);
    }

    if (recovered.size < Number(threshold)) {
      throw new AuthError(1105, `unique owners ${recovered.size} < ${threshold}`, executionId);
    }
  }
}

export async function readSafeNonce(
  publicClient: PublicClient,
  safeAddress: Address,
): Promise<number> {
  const nonce = await publicClient.readContract({
    address: safeAddress,
    abi: [
      {
        name: "getNonce",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "uint256" }],
      },
    ],
    functionName: "getNonce",
  });
  return Number(nonce);
}
