import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
} from "viem";
import { loadArtifact } from "./artifacts.js";
import type { ContractId } from "../../src/types.js";

export interface Layer4AnvilStack {
  readonly engine: Address;
  readonly verifier: Address;
  readonly token1400: Address;
  readonly safe: Address;
  readonly relayer: Address;
  readonly recipient: Address;
  readonly contractId: ContractId;
  readonly obligationHash: Hex;
  readonly oracleHash: Hex;
  readonly partition: Hex;
}

async function deployFromArtifact(
  publicClient: PublicClient,
  wallet: WalletClient,
  artifactPath: string,
  args: readonly unknown[] = [],
): Promise<Address> {
  const artifact = loadArtifact(artifactPath);
  const hash = await wallet.deployContract({
    abi: artifact.abi as never,
    bytecode: artifact.bytecode.object as Hex,
    args: args as never,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error(`Deploy failed: ${artifactPath}`);
  }
  return receipt.contractAddress;
}

/** Deploy mocks + ExecutionEngine and register a partition obligation contract */
export async function deployLayer4Stack(
  publicClient: PublicClient,
  wallet: WalletClient,
  owner: Address,
  relayer: Address,
  recipient: Address,
  safeOwners: readonly [Address, Address],
): Promise<Layer4AnvilStack> {
  const verifier = await deployFromArtifact(
    publicClient,
    wallet,
    "MockZKVerifier.sol/MockZKVerifier.json",
  );
  const identity = await deployFromArtifact(
    publicClient,
    wallet,
    "MockCompliance.sol/MockIdentityRegistry.json",
  );
  const sanctions = await deployFromArtifact(
    publicClient,
    wallet,
    "MockCompliance.sol/MockSanctionsOracle.json",
  );

  const engine = await deployFromArtifact(
    publicClient,
    wallet,
    "ExecutionEngine.sol/ExecutionEngine.json",
    [verifier, identity, sanctions, owner],
  );

  const token1400 = await deployFromArtifact(
    publicClient,
    wallet,
    "MockERC1400.sol/MockERC1400.json",
  );
  const safe = await deployFromArtifact(publicClient, wallet, "MockSafe.sol/MockSafe.json", [
    [safeOwners[0], safeOwners[1]],
    2n,
  ]);

  await wallet.writeContract({
    address: engine,
    abi: loadArtifact("ExecutionEngine.sol/ExecutionEngine.json").abi as never,
    functionName: "setRelayer",
    args: [relayer, true],
  });

  await wallet.writeContract({
    address: identity,
    abi: loadArtifact("MockCompliance.sol/MockIdentityRegistry.json").abi as never,
    functionName: "setVerified",
    args: [recipient, true],
  });
  await wallet.writeContract({
    address: identity,
    abi: loadArtifact("MockCompliance.sol/MockIdentityRegistry.json").abi as never,
    functionName: "setVerified",
    args: [engine, true],
  });
  await wallet.writeContract({
    address: identity,
    abi: loadArtifact("MockCompliance.sol/MockIdentityRegistry.json").abi as never,
    functionName: "setVerified",
    args: [relayer, true],
  });

  await wallet.writeContract({
    address: token1400,
    abi: loadArtifact("MockERC1400.sol/MockERC1400.json").abi as never,
    functionName: "setTransferAllowed",
    args: [true],
  });

  const partition = keccak256("0xenergy-kwh") as Hex;
  const oracleHash = ("0x" + "0".repeat(63) + "1") as Hex;
  const contractId = keccak256("0xe2e-contract") as ContractId;

  const obligations = [
    {
      token: token1400,
      partition,
      to: recipient,
      value: 1_000_000_000_000_000_000n,
      data: "0x" as Hex,
      reversible: true,
    },
  ];

  const o = obligations[0]!;
  const obligationHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters("(address, bytes32, address, uint256, bytes, bool)[]"),
      [[[o.token, o.partition, o.to, o.value, o.data, o.reversible]]],
    ),
  ) as Hex;

  const block = await publicClient.getBlock();
  const disputeDeadline = block.timestamp - 86_400n;

  await wallet.writeContract({
    address: engine,
    abi: loadArtifact("ExecutionEngine.sol/ExecutionEngine.json").abi as never,
    functionName: "registerContract",
    args: [contractId, obligationHash, oracleHash, disputeDeadline],
  });

  await wallet.writeContract({
    address: token1400,
    abi: loadArtifact("MockERC1400.sol/MockERC1400.json").abi as never,
    functionName: "mint",
    args: [partition, engine, obligations[0]!.value],
  });

  return {
    engine,
    verifier,
    token1400,
    safe,
    relayer,
    recipient,
    contractId,
    obligationHash,
    oracleHash,
    partition,
  };
}
