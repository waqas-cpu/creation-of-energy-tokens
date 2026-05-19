import { loadNetworkManifest } from "../config/loadNetworkManifest.js";
import { log } from "../observability/logger.js";

export interface PythPriceUpdate {
  readonly price: bigint;
  readonly conf: bigint;
  readonly expo: number;
  readonly publishTimeMs: number;
  readonly confidenceBps: number;
}

/** Hermes REST client for Pyth price feeds (gate 5.3.2 / E506). */
export class PythPriceClient {
  private readonly baseUrl: string;

  constructor(network = process.env.SUI_NETWORK) {
    this.baseUrl = loadNetworkManifest(network).apis.pythHermes;
  }

  async fetchPriceUpdate(feedId: string): Promise<PythPriceUpdate> {
    const url = `${this.baseUrl}/v2/updates/price/latest?ids[]=${encodeURIComponent(feedId)}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`Pyth Hermes ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as {
      parsed?: { price?: { price?: string; conf?: string; expo?: number; publish_time?: number } }[];
    };
    const parsed = body.parsed?.[0]?.price;
    if (!parsed?.price) {
      throw new Error("Pyth response missing price");
    }
    const price = BigInt(parsed.price);
    const conf = BigInt(parsed.conf ?? "0");
    const expo = parsed.expo ?? 0;
    const publishTimeMs = (parsed.publish_time ?? 0) * 1000;
    const confidenceBps = price > 0n ? Number((conf * 10_000n) / price) : 10_000;
    log("debug", "pyth_price_fetched", { feedId, confidenceBps, publishTimeMs });
    return { price, conf, expo, publishTimeMs, confidenceBps };
  }

  /**
   * VAA bytes for `pyth::update_price_feeds` (pass to buildPythUpdatePtb).
   * Feed IDs are Pyth hex strings (with or without 0x prefix).
   */
  async fetchPriceUpdateBytes(feedIds: readonly string[]): Promise<Uint8Array> {
    const qs = feedIds.map((id) => `ids[]=${encodeURIComponent(id)}`).join("&");
    const url = `${this.baseUrl}/v2/updates/price/latest?${qs}&encoding=hex`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`Pyth Hermes ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as { binary?: { encoding?: string; data?: string[] } };
    const hexChunks = body.binary?.data;
    if (!hexChunks?.length) {
      throw new Error("Pyth Hermes response missing binary.data");
    }
    const hex = hexChunks.join("").replace(/^0x/i, "");
    return Uint8Array.from(hex.match(/.{1,2}/g) ?? [], (b) => parseInt(b, 16));
  }
}
