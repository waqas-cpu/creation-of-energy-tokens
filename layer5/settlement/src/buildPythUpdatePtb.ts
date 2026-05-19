import { Transaction } from "@mysten/sui/transactions";
import { loadNetworkManifest } from "./config/loadNetworkManifest.js";
import { createSuiClientForRpc, type SuiRpcNetwork } from "./suiRpcClient.js";

export interface PythUpdatePtbConfig {
  readonly l5PackageId: string;
  readonly priceFeedObjectId: string;
  readonly clockObjectId?: string;
  readonly network?: string;
}

export interface PythUpdateParams {
  readonly price: bigint;
  readonly expo: number;
  readonly conf: bigint;
  readonly publishTimeMs: bigint;
}

/**
 * Composed PTB: (1) optional Pyth package update via manifest, (2) sync local PriceFeed.
 * Pass `pythUpdateBytes` from Hermes when wiring live Pyth (see @pythnetwork/pyth-sui-js).
 */
export function buildPythUpdatePtb(
  tx: Transaction,
  config: PythUpdatePtbConfig,
  params: PythUpdateParams,
  pythUpdateBytes?: Uint8Array,
): Transaction {
  const manifest = loadNetworkManifest(config.network);
  if (pythUpdateBytes && pythUpdateBytes.length > 0) {
    tx.moveCall({
      target: `${manifest.contracts.pythPackage}::pyth::update_price_feeds`,
      arguments: [
        tx.object(manifest.contracts.pythStateObject),
        tx.pure.vector("u8", [...pythUpdateBytes]),
      ],
    });
  }

  const clock = config.clockObjectId ?? "0x6";
  tx.moveCall({
    target: `${config.l5PackageId}::pyth_price_sync::sync_energy_price_feed`,
    arguments: [
      tx.object(config.priceFeedObjectId),
      tx.pure.u64(params.price),
      tx.pure.u8(params.expo),
      tx.pure.u64(params.conf),
      tx.pure.u64(params.publishTimeMs),
      tx.object(clock),
    ],
  });
  return tx;
}

export async function dryRunPythUpdate(
  config: PythUpdatePtbConfig,
  params: PythUpdateParams,
  sender: string,
): Promise<{ readonly success: boolean; readonly status?: string }> {
  const network = config.network ?? "testnet";
  const net: SuiRpcNetwork =
    network === "mainnet" ? "mainnet" : network === "localnet" ? "localnet" : "testnet";
  const client = createSuiClientForRpc(net);
  const tx = buildPythUpdatePtb(new Transaction(), config, params);
  const result = await client.devInspectTransactionBlock({ transactionBlock: tx, sender });
  return { success: result.effects?.status?.status === "success", status: result.effects?.status?.status };
}
