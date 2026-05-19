import type { SuiEvent, SuiClient } from "@mysten/sui/client";
import type { SuiNetwork } from "../config/loadNetworkManifest.js";
import { createSuiClientForRpc, type SuiRpcNetwork } from "../suiRpcClient.js";
import { log } from "./logger.js";

export interface IndexerOptions {
  readonly network: SuiNetwork;
  readonly rpcUrl?: string;
  readonly packageId: string;
  readonly pollIntervalMs?: number;
}

/** Subscribes to L5 package events for off-chain audit trail (GLOBAL-5). */
export class SuiEventIndexer {
  private readonly client: SuiClient;
  private timer?: ReturnType<typeof setInterval>;
  private cursor: { txDigest: string; eventSeq: string } | null = null;

  constructor(private readonly options: IndexerOptions) {
    this.client = createSuiClientForRpc(options.network as SuiRpcNetwork, options.rpcUrl);
  }

  async pollOnce(handler: (ev: SuiEvent) => void): Promise<number> {
    const res = await this.client.queryEvents({
      query: { MoveEventType: `${this.options.packageId}::bridge_adapter::SettlementEventV1` },
      cursor: this.cursor,
      limit: 50,
      order: "ascending",
    });
    for (const ev of res.data) {
      handler(ev);
    }
    if (res.nextCursor) {
      this.cursor = res.nextCursor;
    }
    return res.data.length;
  }

  start(handler: (ev: SuiEvent) => void): void {
    const interval = this.options.pollIntervalMs ?? 10_000;
    this.timer = setInterval(() => {
      this.pollOnce(handler).catch((err) => {
        log("error", "event_indexer_poll_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, interval);
    log("info", "event_indexer_started", {
      packageId: this.options.packageId,
      intervalMs: interval,
    });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
