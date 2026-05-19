import { Transaction } from "@mysten/sui/transactions";
import { loadNetworkManifest } from "./config/loadNetworkManifest.js";

export interface NativeUsdcSettleConfig {
  readonly l5PackageId: string;
  readonly usdcPackageId?: string;
  readonly marketplaceId: string;
  readonly complianceRegistryId: string;
  readonly priceFeedId: string;
  readonly network?: string;
}

export interface NativeUsdcSettleParams {
  readonly energyCoinId: string;
  readonly usdcCoinId: string;
  readonly slippageBps: bigint;
  readonly wormholeVaaSequence: bigint;
}

export function buildNativeUsdcSettlePtb(
  tx: Transaction,
  config: NativeUsdcSettleConfig,
  params: NativeUsdcSettleParams,
): Transaction {
  const manifest = loadNetworkManifest(config.network);
  const usdcPkg = config.usdcPackageId ?? manifest.contracts.nativeUsdcPackage;
  tx.moveCall({
    target: `${config.l5PackageId}::native_usdc_settlement::settle_native_usdc_entry`,
    arguments: [
      tx.object(config.marketplaceId),
      tx.object(config.complianceRegistryId),
      tx.object(config.priceFeedId),
      tx.object(params.energyCoinId),
      tx.object(params.usdcCoinId),
      tx.pure.u64(params.slippageBps),
      tx.pure.u64(params.wormholeVaaSequence),
    ],
  });
  return tx;
}
