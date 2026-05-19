import {
  bindHandoff,
  defaultDisputeDeadline,
  type ContractId,
  type ExecutionRequest,
  type Obligation,
  type ZKProof,
} from "@sui-energy/layer4-engine";

/**
 * Maps Sui L2/L3 attestation output → EVM L4 ExecutionRequest.
 * Use after layer2 verify_reading + layer3 mint preconditions on Sui.
 */
export interface SuiMintAttestation {
  readonly meterId: string;
  readonly kwh: bigint;
  readonly timestampMs: bigint;
  readonly producerAddress: `0x${string}`;
  readonly energyTokenAddress: `0x${string}`;
  readonly oracleSnapshotHash: `0x${string}`;
  readonly secp256k1Sig: `0x${string}`;
}

export function suiAttestationToExecutionRequest(
  contractId: ContractId,
  att: SuiMintAttestation,
  signatures: readonly `0x${string}`[],
): ExecutionRequest {
  const labelHex = Array.from(new TextEncoder().encode("sui-energy"))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .padEnd(64, "0");
  const partition = ("0x" + labelHex) as `0x${string}`;

  const obligations: Obligation[] = [
    {
      token: att.energyTokenAddress,
      partition,
      to: att.producerAddress,
      value: att.kwh,
      data: "0x",
      reversible: true,
    },
  ];

  const zkProof: ZKProof = {
    proof: att.secp256k1Sig.length > 2 ? att.secp256k1Sig : "0x01",
    inputHash: att.oracleSnapshotHash,
    outputCommitment: ("0x" + "0".repeat(63) + "1") as `0x${string}`,
  };

  const now = BigInt(Math.floor(Date.now() / 1000));
  return bindHandoff(
    contractId,
    obligations,
    zkProof,
    att.oracleSnapshotHash,
    "TRIGGERED",
    defaultDisputeDeadline(now),
    signatures,
  );
}
