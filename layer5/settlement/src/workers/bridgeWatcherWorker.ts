import { BridgeWatcher } from "../bridgeWatcher.js";
import { WormholeBridgeClient } from "../adapters/wormholeBridgeClient.js";
import { log } from "../observability/logger.js";
import { settlementDataDir } from "../persistence/dataDir.js";
import { BridgeStateStore } from "./bridgeStateStore.js";

export function startBridgeWatcherWorker(): () => void {
  const root = settlementDataDir();
  if (!root) {
    log("warn", "bridge_watcher_no_data_dir", {
      hint: "SET SETTLEMENT_DATA_DIR for durable bridge tracking",
    });
  }
  const store = root ? new BridgeStateStore(root) : null;
  const watcher = new BridgeWatcher();
  const wormhole = new WormholeBridgeClient();

  if (store) {
    for (const row of store.load()) {
      watcher.track(row.bridgeTxId);
    }
  }

  const pollMs = Number(process.env.BRIDGE_WATCHER_POLL_MS ?? "30000") || 30_000;

  const timer = setInterval(async () => {
    const now = Date.now();
    const stalled = watcher.poll(now);
    for (const id of stalled) {
      log("error", "bridge_vaa_stalled", { bridgeTxId: id, thresholdMs: 3_600_000 });
    }

    if (!store) return;
    const rows = store.load();
    for (const row of rows) {
      try {
        const vaa = await wormhole.fetchSignedVaa(
          row.emitterChain,
          row.emitterAddress,
          row.sequence,
        );
        if (vaa.signed) {
          watcher.confirm(row.bridgeTxId);
          store.confirm(row.bridgeTxId);
          log("info", "bridge_vaa_confirmed", { bridgeTxId: row.bridgeTxId });
        }
      } catch (e) {
        log("warn", "bridge_vaa_poll_failed", {
          bridgeTxId: row.bridgeTxId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }, pollMs);

  log("info", "bridge_watcher_started", { pollMs, durable: Boolean(store) });

  return () => clearInterval(timer);
}

/** Register a bridge message for VAA polling (called from API or indexer). */
export function trackBridgeMessage(
  bridgeTxId: string,
  emitterChain: number,
  emitterAddress: string,
  sequence: number,
): void {
  const root = settlementDataDir();
  if (!root) return;
  const store = new BridgeStateStore(root);
  store.track({
    bridgeTxId,
    emitterChain,
    emitterAddress,
    sequence,
    startedAt: Date.now(),
  });
}
