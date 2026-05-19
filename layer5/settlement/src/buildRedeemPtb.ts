/**
 * Layer 5 redemption PTB — canonical entry `redemption_orchestrator::redeem_atomic`.
 * Gates 5.5-A..E: ordered Move calls, dry-run before submit.
 */
import { Transaction } from "@mysten/sui/transactions";

export interface Layer5PackageTargets {
  readonly l5PackageId: string;
  readonly l3GridPackageId: string;
}

export interface Layer5RedeemObjects {
  readonly treasuryGuardId: string;
  readonly energyBatchId: string;
  readonly energyCoinId: string;
  readonly energyMeterId: string;
  readonly complianceRegistryId: string;
  readonly jurisdictionPolicyId: string;
  readonly redemptionRegistryId: string;
  readonly gridOperatorCapId: string;
  readonly billingOperatorCapId: string;
  readonly gridSettlementLedgerId: string;
}

export interface RedeemAtomicArgs {
  readonly redemptionId: Uint8Array;
  readonly kwh: bigint;
  readonly billingPeriodEndMs: bigint;
  readonly billingPeriodOverride: boolean;
  readonly usdcEquiv: bigint;
}

export function buildLayer5RedeemPtb(
  tx: Transaction,
  targets: Layer5PackageTargets,
  objects: Layer5RedeemObjects,
  args: RedeemAtomicArgs,
): Transaction {
  tx.moveCall({
    target: `${targets.l5PackageId}::redemption_orchestrator::redeem_atomic`,
    arguments: [
      tx.object(objects.treasuryGuardId),
      tx.object(objects.energyBatchId),
      tx.object(objects.energyCoinId),
      tx.object(objects.energyMeterId),
      tx.object(objects.complianceRegistryId),
      tx.object(objects.jurisdictionPolicyId),
      tx.object(objects.redemptionRegistryId),
      tx.object(objects.gridOperatorCapId),
      tx.object(objects.billingOperatorCapId),
      tx.object(objects.gridSettlementLedgerId),
      tx.pure.vector("u8", [...args.redemptionId]),
      tx.pure.u64(args.kwh),
      tx.pure.u64(args.billingPeriodEndMs),
      tx.pure.bool(args.billingPeriodOverride),
      tx.pure.u64(args.usdcEquiv),
    ],
  });
  return tx;
}

export function redemptionIdBytes(redemptionId: string): Uint8Array {
  const hex = redemptionId.startsWith("0x") ? redemptionId.slice(2) : redemptionId;
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  return new TextEncoder().encode(redemptionId);
}
