import { describe, expect, it, beforeAll } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { PipelineRunner } from "../../src/pipelineRunner.js";
import { computeExecutionId } from "../../src/l3Handoff.js";
import type { ExecutionRequest } from "../../src/types.js";
import {
  buildExecutionAuthMessage,
  EXECUTION_AUTH_DOMAIN,
  EXECUTION_AUTH_EIP712_TYPES,
  readSafeNonce,
} from "../../src/safeAuth.js";
import { deployLayer4Stack } from "./deployHarness.js";
import { loadArtifact } from "./artifacts.js";

const ANVIL_RPC = process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";

const ANVIL_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f094538e9dc51f988429e27e9e2f088b1e329e52",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
] as const;

const MET_COMMITMENT = ("0x" + "0".repeat(63) + "1") as Hex;

async function anvilReachable(): Promise<boolean> {
  try {
    const client = createPublicClient({ transport: http(ANVIL_RPC) });
    await client.getChainId();
    return true;
  } catch {
    return false;
  }
}

const skipE2e = !(await anvilReachable());

describe.skipIf(skipE2e)("Anvil E2E — engine ↔ ExecutionEngine", () => {
  const owner = privateKeyToAccount(ANVIL_KEYS[0]);
  const signer1 = privateKeyToAccount(ANVIL_KEYS[0]);
  const signer2 = privateKeyToAccount(ANVIL_KEYS[1]);
  const relayer = privateKeyToAccount(ANVIL_KEYS[2]);
  /** Anvil default account #3 — valid EIP-55 checksum */
  const recipient = getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

  let stack: Awaited<ReturnType<typeof deployLayer4Stack>>;
  let publicClient: ReturnType<typeof createPublicClient>;
  let relayerWallet: ReturnType<typeof createWalletClient>;

  beforeAll(async () => {
    publicClient = createPublicClient({
      chain: foundry,
      transport: http(ANVIL_RPC),
    });

    const ownerWallet = createWalletClient({
      account: owner,
      chain: foundry,
      transport: http(ANVIL_RPC),
    });

    relayerWallet = createWalletClient({
      account: relayer,
      chain: foundry,
      transport: http(ANVIL_RPC),
    });

    stack = await deployLayer4Stack(
      publicClient,
      ownerWallet,
      owner.address,
      relayer.address,
      recipient,
      [signer1.address, signer2.address],
    );
  }, 120_000);

  it("reads Safe threshold and nonce from chain", async () => {
    const threshold = await publicClient.readContract({
      address: stack.safe,
      abi: loadArtifact("MockSafe.sol/MockSafe.json").abi as never,
      functionName: "getThreshold",
    });
    expect(threshold).toBe(2n);
    expect(await readSafeNonce(publicClient, stack.safe)).toBe(0);
  });

  it("executes ERC-1400 batch via live PipelineRunner", async () => {
    const obligations = [
      {
        token: stack.token1400,
        partition: stack.partition,
        to: recipient,
        value: 1_000_000_000_000_000_000n,
        data: "0x" as Hex,
        reversible: true,
      },
    ] as const;

    const executionId = computeExecutionId(stack.contractId, stack.obligationHash, 0n);
    const message = buildExecutionAuthMessage(
      stack.contractId,
      stack.obligationHash,
      executionId,
    );

    const domain = {
      ...EXECUTION_AUTH_DOMAIN,
      chainId: foundry.id,
      verifyingContract: stack.engine,
    };

    const sig1 = await signer1.signTypedData({
      domain,
      types: EXECUTION_AUTH_EIP712_TYPES,
      primaryType: "ExecutionAuthorization",
      message,
    });
    const sig2 = await signer2.signTypedData({
      domain,
      types: EXECUTION_AUTH_EIP712_TYPES,
      primaryType: "ExecutionAuthorization",
      message,
    });

    const block = await publicClient.getBlock();
    const request: ExecutionRequest = {
      contractId: stack.contractId,
      currentState: "TRIGGERED",
      obligationHash: stack.obligationHash,
      oracleSnapshotHash: stack.oracleHash,
      zkProof: {
        proof: "0x04",
        inputHash: stack.oracleHash,
        outputCommitment: MET_COMMITMENT,
      },
      disputeDeadline: block.timestamp - 86_400n,
      activeChallenge: false,
      obligations,
      eip712Signatures: [sig1, sig2],
    };

    const runner = new PipelineRunner({
      engineAddress: stack.engine,
      chainId: foundry.id,
      relayerAddress: relayer.address,
      submitMode: "live",
      walletClient: relayerWallet,
      safeAuth: {
        safeAddress: stack.safe,
        chainId: foundry.id,
        verifyingContract: stack.engine,
        publicClient,
        threshold: { m: 2, n: 2 },
      },
    });

    const outcome = await runner.run(
      request,
      {
        process: async () => ({
          acknowledged: true,
          proofIds: ["0x" + "aa".repeat(32)],
          regulatoryReportCid: "0x" + "bb".repeat(32),
        }),
      },
      { estimatedGas: 500_000n, baseFee: 1_000_000_000n, priorityFee: 1_000_000_000n },
    );

    expect(outcome.status).toBe("FINALIZED");

    const balance = await publicClient.readContract({
      address: stack.token1400,
      abi: loadArtifact("MockERC1400.sol/MockERC1400.json").abi as never,
      functionName: "balanceOfByPartition",
      args: [stack.partition, recipient],
    });
    expect(balance).toBe(obligations[0]!.value);
  }, 60_000);
});
