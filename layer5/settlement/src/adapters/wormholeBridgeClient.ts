import { BRIDGE_TIMELOCK_MS } from "../constants.js";
import { loadNetworkManifest } from "../config/loadNetworkManifest.js";
import { log } from "../observability/logger.js";

export interface VaaStatus {
  readonly sequence: number;
  readonly emitted: boolean;
  readonly signed: boolean;
  readonly vaaBase64?: string;
}

export interface WormholePublishResult {
  readonly sequence: number;
  readonly txId: string;
}

/** Gate 5.2 / 5.4 — Wormhole VAAs via Wormholescan (mainnet production path). */
export class WormholeBridgeClient {
  private lastSequence = 0;
  private readonly apiBase: string;
  private readonly chainId: number;

  constructor(network = process.env.SUI_NETWORK) {
    const manifest = loadNetworkManifest(network);
    this.apiBase = manifest.apis.wormholeScan;
    this.chainId = network === "mainnet" ? 21 : 21;
  }

  publishMessage(payload: Uint8Array): WormholePublishResult {
    const sequence = this.lastSequence + 1;
    this.lastSequence = sequence;
    log("info", "wormhole_publish_queued", { sequence, payloadLen: payload.length });
    return { sequence, txId: `pending-wh-${sequence}` };
  }

  checkVaaSequence(incoming: number): { readonly ok: boolean; readonly stale: boolean } {
    if (incoming <= this.lastSequence) {
      return { ok: true, stale: true };
    }
    this.lastSequence = incoming;
    return { ok: true, stale: false };
  }

  timelockRemainingMs(startedAt: number, now = Date.now()): number {
    const elapsed = now - startedAt;
    return elapsed >= BRIDGE_TIMELOCK_MS ? 0 : BRIDGE_TIMELOCK_MS - elapsed;
  }

  /** Fetch signed VAA from Wormholescan (gate 5.2.5 / RULE-5.4-E). */
  async fetchSignedVaa(
    emitterChain: number,
    emitterAddress: string,
    sequence: number,
  ): Promise<VaaStatus> {
    const addr = emitterAddress.replace(/^0x/, "");
    const url = `${this.apiBase}/api/v1/vaas/${emitterChain}/${addr}/${sequence}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.status === 404) {
      return { sequence, emitted: false, signed: false };
    }
    if (!res.ok) {
      throw new Error(`Wormholescan ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as { vaa?: string };
    const signed = Boolean(body.vaa && body.vaa.length > 0);
    if (signed) {
      this.checkVaaSequence(sequence);
    }
    log("info", "wormhole_vaa_fetched", { sequence, signed });
    return {
      sequence,
      emitted: true,
      signed,
      vaaBase64: body.vaa,
    };
  }

  async awaitVaaWithTimelock(
    emitterChain: number,
    emitterAddress: string,
    sequence: number,
    bridgeStartedAt: number,
  ): Promise<VaaStatus> {
    const remaining = this.timelockRemainingMs(bridgeStartedAt);
    if (remaining > 0) {
      throw new Error(`Wormhole timelock active: ${remaining}ms remaining (RULE-5.4-B)`);
    }
    return this.fetchSignedVaa(emitterChain, emitterAddress, sequence);
  }
}
