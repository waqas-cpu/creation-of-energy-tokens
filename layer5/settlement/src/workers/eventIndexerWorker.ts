import type { SuiEvent } from "@mysten/sui/client";
import { SuiEventIndexer } from "../observability/suiEventIndexer.js";
import { SettlementService } from "../settlementService.js";
import { createPersistenceFromEnv } from "../persistence/createPersistenceFromEnv.js";
import type { ContractId, ExecutionId } from "../types.js";
import { log } from "../observability/logger.js";
import { trackBridgeMessage } from "./bridgeWatcherWorker.js";

function eventToExecution(ev: SuiEvent): {
  contractId: ContractId;
  executionId: ExecutionId;
  txHash: `0x${string}`;
  confirmationBlock: number;
} | null {
  const tx = ev.id.txDigest;
  if (!tx) return null;
  const parsed = ev.parsedJson as Record<string, unknown> | null;
  const redemptionId =
    (parsed?.redemption_id as string) ??
    (parsed?.redemptionId as string) ??
    tx.slice(0, 66);
  return {
    contractId: ((parsed?.contract_id as string) ?? redemptionId) as ContractId,
    executionId: redemptionId as ExecutionId,
    txHash: tx as `0x${string}`,
    confirmationBlock: Number(ev.timestampMs ?? 0),
  };
}

export function startEventIndexerWorker(packageId: string): () => void {
  const network = (process.env.SUI_NETWORK ?? "testnet") as "testnet" | "mainnet" | "localnet";
  const persistence = createPersistenceFromEnv();
  const settlement = new SettlementService(persistence);

  const indexer = new SuiEventIndexer({
    network,
    packageId,
    pollIntervalMs: Number(process.env.EVENT_INDEXER_POLL_MS ?? "10_000"),
  });

  const handler = async (ev: SuiEvent) => {
    const mapped = eventToExecution(ev);
    if (!mapped) return;

    log("info", "indexer_event", {
      type: ev.type,
      tx: mapped.txHash,
    });

    const parsed = ev.parsedJson as Record<string, unknown> | null;
    if (parsed?.bridge_sequence != null && parsed?.emitter_address) {
      trackBridgeMessage(
        `wh-${mapped.txHash}`,
        Number(parsed.emitter_chain ?? 21),
        String(parsed.emitter_address),
        Number(parsed.bridge_sequence),
      );
    }

    await settlement.process(
      {
        ...mapped,
        executionBlock: mapped.confirmationBlock,
        settled: true,
        rollbackReason: "0x" + "0".repeat(64) as `0x${string}`,
        proofIds: [],
        regulatoryReportCid: "0x" + "0".repeat(64) as `0x${string}`,
        gasUsed: 0n,
      },
      {
        consumer: String(parsed?.consumer_addr ?? parsed?.consumer ?? "0x0"),
        kwhClaim: BigInt(String(parsed?.kwh ?? "1")),
      },
    );
  };

  indexer.start((ev) => {
    void handler(ev).catch((err) => {
      log("error", "indexer_handler_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });

  return () => indexer.stop();
}
