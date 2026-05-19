/**
 * G-L2-06 — Atomic minting PTB builder (R6.1, R6.2).
 * Sequence: verify_reading → assert_producer → mint_energy → batch_receipt
 */
import { Transaction } from "@mysten/sui/transactions";

export const GAS_BUDGET_STANDARD = 10_000_000;
export const GAS_BUDGET_ZK = 50_000_000;

export interface Layer2SharedObjects {
  deviceRegistryId: string;
  processedAttestationsId: string;
  energyMeterId: string;
  oracleAggregatorId: string;
  complianceRegistryId: string;
  jurisdictionBlacklistId: string;
  zkRegistryId?: string;
}

export interface MintPtbTargets {
  oraclePackageId: string;
  /** Layer 3 minting_engine package — wired when deployed */
  mintingPackageId: string;
  batchReceiptPackageId: string;
}

export interface VerifyReadingArgs {
  attestation: {
    deviceId: number[];
    kwhDelta: bigint;
    timestampMs: bigint;
    secp256k1Sig: number[];
  };
  useZk: boolean;
  zkProof?: number[];
  zkPublicInputs?: number[];
}

/**
 * Builds the atomic mint PTB with all shared objects explicitly listed (R6.2).
 */
export function buildMintPtb(
  tx: Transaction,
  objects: Layer2SharedObjects,
  targets: MintPtbTargets,
  args: VerifyReadingArgs,
  treasuryCapId: string,
  producerAddress: string,
): Transaction {
  const gasBudget = args.useZk ? GAS_BUDGET_ZK : GAS_BUDGET_STANDARD;
  tx.setGasBudget(gasBudget);

  const attestationArg = tx.pure.vector("u8", args.attestation.deviceId);
  const kwhArg = tx.pure.u64(args.attestation.kwhDelta);
  const tsArg = tx.pure.u64(args.attestation.timestampMs);
  const sigArg = tx.pure.vector("u8", args.attestation.secp256k1Sig);

  let readingProof;

  if (args.useZk && objects.zkRegistryId) {
    readingProof = tx.moveCall({
      target: `${targets.oraclePackageId}::oracle::verify_reading_with_zk`,
      arguments: [
        tx.object(objects.deviceRegistryId),
        tx.object(objects.processedAttestationsId),
        tx.object(objects.energyMeterId),
        tx.object(objects.zkRegistryId),
        tx.pure.vector("u8", args.zkProof ?? []),
        tx.pure.vector("u8", args.zkPublicInputs ?? []),
        // Additional ZK args passed as pure vectors in production
      ],
    });
  } else {
    readingProof = tx.moveCall({
      target: `${targets.oraclePackageId}::oracle::verify_reading`,
      arguments: [
        tx.object(objects.energyMeterId),
        tx.object(objects.deviceRegistryId),
        tx.object(objects.processedAttestationsId),
        attestationArg,
        kwhArg,
        tsArg,
        sigArg,
      ],
    });
  }

  tx.moveCall({
    target: `${targets.oraclePackageId}::oracle::assert_producer_for_mint`,
    arguments: [
      readingProof,
      tx.object(objects.complianceRegistryId),
      tx.object(objects.jurisdictionBlacklistId),
      tx.object(objects.energyMeterId),
    ],
  });

  const mintedCoin = tx.moveCall({
    target: `${targets.mintingPackageId}::minting_engine::mint_energy`,
    arguments: [
      tx.object(treasuryCapId),
      tx.object(objects.energyMeterId),
      kwhArg,
      sigArg,
    ],
  });

  tx.transferObjects([mintedCoin], producerAddress);

  tx.moveCall({
    target: `${targets.batchReceiptPackageId}::batch_receipt::issue`,
    arguments: [
      tx.object(objects.energyMeterId),
      kwhArg,
      tx.pure.u8(0),
    ],
  });

  tx.moveCall({
    target: `${targets.oraclePackageId}::oracle::finalize_layer2_verification`,
    arguments: [
      readingProof,
      tx.object(objects.complianceRegistryId),
      tx.object(objects.jurisdictionBlacklistId),
      tx.object(objects.energyMeterId),
      tx.pure.vector("address", []),
      tx.pure.option("vector<u8>", null),
    ],
  });

  return tx;
}

/** Explicit shared object IDs for PTB input listing (R6.2 audit). */
export function listRequiredSharedObjects(
  objects: Layer2SharedObjects,
  treasuryCapId: string,
): string[] {
  const ids = [
    objects.deviceRegistryId,
    objects.processedAttestationsId,
    objects.energyMeterId,
    objects.oracleAggregatorId,
    objects.complianceRegistryId,
    objects.jurisdictionBlacklistId,
    treasuryCapId,
  ];
  if (objects.zkRegistryId) ids.push(objects.zkRegistryId);
  return ids;
}
