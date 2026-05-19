import { auditRecordFromResult } from "./auditStore.js";
import { ZERO_HEX_32 } from "./constants.js";
import { createPersistenceFromEnv, type SettlementPersistence } from "./persistence/createPersistenceFromEnv.js";
import type { SettlementArchive, SettlementAudit, SettlementReporter } from "./persistence/settlementPersistenceTypes.js";
import { SettlementOrchestrator } from "./settlementOrchestrator.js";
import type { ExecutionResult } from "./types.js";

export interface SettlementOutcome {
  readonly acknowledged: boolean;
  readonly proofIds: readonly `0x${string}`[];
  readonly regulatoryReportCid: `0x${string}`;
  readonly traceId?: string;
  readonly redemptionId?: string;
}

export interface SettlementProcessOptions {
  readonly consumer?: string;
  readonly kwhClaim?: bigint;
  readonly coinBalanceMicro?: bigint;
  readonly batchKwh?: bigint;
  readonly batchRedeemed?: boolean;
}

/**
 * Layer 5 — Settlement & Utility + L4 audit (gates 4.8.x, 5.1–5.5).
 * L4 → L5 is unidirectional; L5 ack required before L4 FINALIZED.
 */
export class SettlementService {
  private readonly archive: SettlementArchive;
  private readonly reporter: SettlementReporter;
  readonly auditStore: SettlementAudit;
  readonly orchestrator = new SettlementOrchestrator();

  constructor(persistence?: SettlementPersistence) {
    const p = persistence ?? createPersistenceFromEnv();
    this.archive = p.archive;
    this.reporter = p.reporter;
    this.auditStore = p.audit;
  }

  async process(
    result: ExecutionResult,
    options: SettlementProcessOptions = {},
  ): Promise<SettlementOutcome> {
    if (!result.settled) {
      return {
        acknowledged: false,
        proofIds: [],
        regulatoryReportCid: ZERO_HEX_32,
      };
    }

    const proofCid = await this.archive.archive(result);
    let reportCid: `0x${string}`;
    try {
      reportCid = await this.reporter.generateReport(result);
    } catch {
      reportCid = ZERO_HEX_32;
    }

    this.auditStore.append(auditRecordFromResult(result, proofCid, reportCid));

    const kwhClaim = options.kwhClaim ?? 1n;
    const planOutcome = await this.orchestrator.processL4Execution(result, {
      consumer: options.consumer ?? "0x0",
      kwhClaim,
      coinBalanceMicro: options.coinBalanceMicro ?? kwhClaim * 1_000_000n,
      batchKwh: options.batchKwh ?? kwhClaim,
      batchRedeemed: options.batchRedeemed ?? false,
      billingPeriodEndMs: Date.now(),
    });

    return {
      acknowledged: true,
      proofIds: [proofCid],
      regulatoryReportCid: reportCid,
      traceId: planOutcome?.traceId,
      redemptionId: planOutcome?.redemptionId,
    };
  }
}
