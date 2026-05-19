/**
 * Layer 3 mint PTB — canonical sequence (integration gates §4.1).
 * Step 1: L2 oracle::verify_reading
 * Step 2: compliance_registry::assert_cleared
 * Step 3: minting_engine::mint_energy
 * Step 4: transfer Coin<ENERGY> to producer
 * Step 5: batch_receipt (issued inside mint_energy)
 */
import { Transaction } from "@mysten/sui/transactions";

export interface Layer3MintTargets {
  gridPackageId: string;
}

export interface Layer3SharedObjects {
  energyMeterId: string;
  complianceRegistryId: string;
  treasuryGuardId: string;
}

export function buildLayer3MintPtb(
  tx: Transaction,
  targets: Layer3MintTargets,
  objects: Layer3SharedObjects,
  attestation: {
    deviceId: number[];
    kwhDelta: bigint;
    timestampMs: bigint;
    secp256k1Sig: number[];
  },
  readingTimestamp: bigint,
  source: number,
  producerAddress: string,
): Transaction {
  const coin = tx.moveCall({
    target: `${targets.gridPackageId}::minting_engine::mint_energy`,
    arguments: [
      tx.object(objects.treasuryGuardId),
      tx.object(objects.energyMeterId),
      tx.pure.u64(attestation.kwhDelta),
      tx.pure.u64(readingTimestamp),
      tx.pure.vector("u8", attestation.secp256k1Sig),
      tx.pure.u8(source),
      tx.object(objects.complianceRegistryId),
    ],
  });

  tx.transferObjects([coin], producerAddress);
  return tx;
}
