import { describe, expect, it } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import { buildPythUpdatePtb } from "../src/buildPythUpdatePtb.js";
import { buildNativeUsdcSettlePtb } from "../src/buildNativeUsdcSettlePtb.js";
import {
  buildWormholePublishOnlyPtb,
  buildWormholeRecPtb,
} from "../src/buildWormholeRecPtb.js";
import { loadNetworkManifest } from "../src/config/loadNetworkManifest.js";

const L5 =
  "0x00000000000000000000000000000000000000000000000000000000000000a5" as const;

const OBJ = {
  feed: "0x0000000000000000000000000000000000000000000000000000000000000001",
  market: "0x0000000000000000000000000000000000000000000000000000000000000002",
  comp: "0x0000000000000000000000000000000000000000000000000000000000000003",
  energy: "0x0000000000000000000000000000000000000000000000000000000000000004",
  usdc: "0x0000000000000000000000000000000000000000000000000000000000000005",
  wh: "0x0000000000000000000000000000000000000000000000000000000000000006",
  emit: "0x0000000000000000000000000000000000000000000000000000000000000007",
  batch: "0x0000000000000000000000000000000000000000000000000000000000000008",
  meter: "0x0000000000000000000000000000000000000000000000000000000000000009",
  wl: "0x000000000000000000000000000000000000000000000000000000000000000a",
  fee: "0x000000000000000000000000000000000000000000000000000000000000000b",
  ticket: "0x000000000000000000000000000000000000000000000000000000000000000c",
} as const;

function serializedTargets(tx: Transaction): string {
  return tx.serialize();
}

describe("Pyth / native USDC / Wormhole PTB builders", () => {
  it("buildPythUpdatePtb syncs energy price feed", () => {
    const tx = buildPythUpdatePtb(
      new Transaction(),
      {
        l5PackageId: L5,
        priceFeedObjectId: OBJ.feed,
        network: "testnet",
      },
      {
        price: 2_000_000n,
        expo: 6,
        conf: 0n,
        publishTimeMs: 1_700_000_000_000n,
      },
    );
    const body = serializedTargets(tx);
    expect(body).toContain(`${L5}::pyth_price_sync::sync_energy_price_feed`);
    expect(body).not.toContain("update_price_feeds");
  });

  it("buildPythUpdatePtb optionally prepends Pyth update_price_feeds", () => {
    const manifest = loadNetworkManifest("testnet");
    const tx = buildPythUpdatePtb(
      new Transaction(),
      { l5PackageId: L5, priceFeedObjectId: OBJ.feed, network: "testnet" },
      { price: 1n, expo: 8, conf: 100n, publishTimeMs: 1n },
      new Uint8Array([1, 2, 3]),
    );
    const body = serializedTargets(tx);
    expect(body).toContain(`${manifest.contracts.pythPackage}::pyth::update_price_feeds`);
    expect(body).toContain(`${L5}::pyth_price_sync::sync_energy_price_feed`);
  });

  it("buildNativeUsdcSettlePtb targets settle_native_usdc_entry", () => {
    const tx = buildNativeUsdcSettlePtb(
      new Transaction(),
      {
        l5PackageId: L5,
        marketplaceId: OBJ.market,
        complianceRegistryId: OBJ.comp,
        priceFeedId: OBJ.feed,
        network: "testnet",
      },
      {
        energyCoinId: OBJ.energy,
        usdcCoinId: OBJ.usdc,
        slippageBps: 50n,
        wormholeVaaSequence: 1n,
      },
    );
    expect(serializedTargets(tx)).toContain(
      `${L5}::native_usdc_settlement::settle_native_usdc_entry`,
    );
  });

  it("buildWormholeRecPtb targets bridge_rec_core", () => {
    const tx = buildWormholeRecPtb(
      new Transaction(),
      {
        l5PackageId: L5,
        wormholeStateId: OBJ.wh,
        emitterCapId: OBJ.emit,
        energyBatchId: OBJ.batch,
        energyMeterId: OBJ.meter,
        bridgeWhitelistId: OBJ.wl,
        complianceRegistryId: OBJ.comp,
        messageFeeCoinId: OBJ.fee,
        network: "testnet",
      },
      { destinationChain: 2 },
    );
    expect(serializedTargets(tx)).toContain(`${L5}::carbon_bridge::bridge_rec_core`);
  });

  it("buildWormholePublishOnlyPtb targets wormhole publish_message", () => {
    const manifest = loadNetworkManifest("testnet");
    const tx = buildWormholePublishOnlyPtb(
      new Transaction(),
      {
        l5PackageId: L5,
        wormholeStateId: OBJ.wh,
        emitterCapId: OBJ.emit,
        energyBatchId: OBJ.batch,
        energyMeterId: OBJ.meter,
        bridgeWhitelistId: OBJ.wl,
        complianceRegistryId: OBJ.comp,
        messageFeeCoinId: OBJ.fee,
        network: "testnet",
      },
      OBJ.ticket,
    );
    expect(serializedTargets(tx)).toContain(
      `${manifest.contracts.wormholePackage}::publish_message::publish_message`,
    );
  });
});
