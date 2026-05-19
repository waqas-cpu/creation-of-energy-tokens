import { Transaction } from "@mysten/sui/transactions";
import { loadNetworkManifest } from "./config/loadNetworkManifest.js";

export interface WormholeRecPtbConfig {
  readonly l5PackageId: string;
  readonly wormholePackageId?: string;
  readonly wormholeStateId: string;
  readonly emitterCapId: string;
  readonly energyBatchId: string;
  readonly energyMeterId: string;
  readonly bridgeWhitelistId: string;
  readonly complianceRegistryId: string;
  readonly clockId?: string;
  readonly messageFeeCoinId: string;
  readonly network?: string;
}

export interface WormholeRecParams {
  readonly destinationChain: number;
}

/**
 * Single PTB: Wormhole publish + carbon `bridge_rec_core`.
 * Fee coin must cover wormhole message_fee (zero allowed on stub/test).
 */
export function buildWormholeRecPtb(
  tx: Transaction,
  config: WormholeRecPtbConfig,
  params: WormholeRecParams,
): Transaction {
  const manifest = loadNetworkManifest(config.network);
  const wormholePkg = config.wormholePackageId ?? manifest.contracts.wormholePackage;
  const clock = config.clockId ?? "0x6";

  tx.moveCall({
    target: `${config.l5PackageId}::carbon_bridge::bridge_rec_core`,
    arguments: [
      tx.object(config.energyBatchId),
      tx.object(config.energyMeterId),
      tx.object(config.emitterCapId),
      tx.object(config.wormholeStateId),
      tx.object(config.messageFeeCoinId),
      tx.object(config.bridgeWhitelistId),
      tx.object(config.complianceRegistryId),
      tx.pure.u16(params.destinationChain),
      tx.object(clock),
    ],
  });
  return tx;
}

/** Two-step PTB pattern matching Wormhole docs: prepare in L5, publish from Wormhole package. */
export function buildWormholePublishOnlyPtb(
  tx: Transaction,
  config: WormholeRecPtbConfig,
  ticketId: string,
): Transaction {
  const manifest = loadNetworkManifest(config.network);
  const wormholePkg = config.wormholePackageId ?? manifest.contracts.wormholePackage;
  const clock = config.clockId ?? "0x6";
  tx.moveCall({
    target: `${wormholePkg}::publish_message::publish_message`,
    arguments: [
      tx.object(config.wormholeStateId),
      tx.object(config.messageFeeCoinId),
      tx.object(ticketId),
      tx.object(clock),
    ],
  });
  return tx;
}
