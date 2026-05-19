import type { ExecutionResult } from "./types.js";
import { assertCreditOrThrow } from "./creditValidation.js";
import { BatchRedemptionTracker } from "./batchRedemption.js";
import { BurnEngine } from "./burnEngine.js";
import { BridgeReportingAdapter } from "./bridgeReporting.js";
import { UtilityBillingAdapter } from "./utilityBillingAdapter.js";
import { CarbonCreditBridge } from "./carbonBridge.js";
import { UsdcSettlementAdapter } from "./usdcSettlement.js";
import {
  GAS_BUFFER_BPS,
  GAS_PER_STEP_MIST,
  KWH_SCALE,
  MAX_PTB_MOVE_CALLS,
  ZERO_HEX_32,
} from "./constants.js";
import { WormholeBridgeClient } from "./adapters/wormholeBridgeClient.js";
import { CircleOfframpClient } from "./adapters/circleOfframpClient.js";
import { GridOperatorClient } from "./adapters/gridOperatorClient.js";
import { suiPtbConfigFromEnv } from "./config/deploymentFromEnv.js";
import { SuiPtbClient, type SuiPtbConfig } from "./suiPtbClient.js";
import { validateSettlementEventV1 } from "./eventSchemaValidator.js";
import { PythPriceClient } from "./adapters/pythPriceClient.js";
import { log } from "./observability/logger.js";
import { loadNetworkManifest } from "./config/loadNetworkManifest.js";

export interface RedemptionPlan {
  readonly redemptionId: string;
  readonly consumer: string;
  readonly kwhClaim: bigint;
  readonly coinBalanceMicro: bigint;
  readonly batchKwh: bigint;
  readonly batchRedeemed: boolean;
  readonly billingPeriodEndMs: number;
}

export interface OrchestratorOutcome {
  readonly traceId: string;
  readonly redemptionId: string;
  readonly gasBudgetMist: bigint;
  readonly ptbSteps: readonly string[];
  readonly creditNoteMemo: string;
}

/** Module 5.5 — PTB builder / dry-run planner (RULE-5.5-A..E). */
export class SettlementOrchestrator {
  readonly redemptions = new BatchRedemptionTracker();
  readonly burns = new BurnEngine();
  readonly events = new BridgeReportingAdapter();
  readonly billing = new UtilityBillingAdapter();
  readonly carbon = new CarbonCreditBridge();
  readonly usdc = new UsdcSettlementAdapter();
  readonly wormhole = new WormholeBridgeClient();
  readonly circle = new CircleOfframpClient();
  readonly gridOperator = new GridOperatorClient();
  readonly suiPtb: SuiPtbClient;

  readonly pyth = new PythPriceClient();

  constructor(suiConfig?: SuiPtbConfig) {
    this.suiPtb = new SuiPtbClient(suiConfig ?? suiPtbConfigFromEnv());
  }

  async planRedemption(plan: RedemptionPlan): Promise<OrchestratorOutcome> {
    const steps = [
      "validate_credit",
      "assert_consumer_kyc",
      "mark_redeemed",
      "burn_energy",
      "emit_settlement_event",
      "record_grid_ledger",
    ];
    if (steps.length > MAX_PTB_MOVE_CALLS) {
      throw new Error("PTB exceeds max Move calls");
    }

    assertCreditOrThrow({
      coinBalanceMicro: plan.coinBalanceMicro,
      batchKwh: plan.batchKwh,
      batchRedeemed: plan.batchRedeemed,
      kwhClaim: plan.kwhClaim,
    });

    const baseGas = 1_000_000n;
    const gasBudget =
      baseGas + BigInt(steps.length) * GAS_PER_STEP_MIST + (baseGas * GAS_BUFFER_BPS) / 10_000n;

    const creditNote = this.billing.issueCreditNote({
      consumer: plan.consumer,
      kwh: plan.kwhClaim,
      redemptionId: plan.redemptionId,
      periodEndMs: plan.billingPeriodEndMs,
    });

    const manifest = loadNetworkManifest(process.env.SUI_NETWORK);
    const feedId = process.env.PYTH_PRICE_FEED_ID;
    if (feedId && process.env.SUI_NETWORK === "mainnet") {
      try {
        const px = await this.pyth.fetchPriceUpdate(feedId);
        log("info", "pyth_price_for_redemption", {
          confidenceBps: px.confidenceBps,
          publishTimeMs: px.publishTimeMs,
        });
      } catch (e) {
        log("warn", "pyth_price_fetch_skipped", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const gridApi = process.env.GRID_OPERATOR_API;
    if (gridApi) {
      await this.gridOperator.syncWithErp(gridApi, creditNote, plan.redemptionId);
    } else if (manifest.network !== "mainnet") {
      await this.gridOperator.syncWithErp("http://127.0.0.1:9999/erp", creditNote, plan.redemptionId);
    }

    const dryRun = await this.suiPtb.dryRun(plan);
    if (!dryRun.success) {
      throw new Error("PTB dry-run simulation failed (gate 5.5-B)");
    }

    const schemaCheck = validateSettlementEventV1({
      schema_version: "v1.0.0",
      event_type: "REDEMPTION",
      redemption_id: plan.redemptionId,
      kwh: plan.kwhClaim,
      consumer_addr: plan.consumer,
      producer_addr: plan.consumer,
      timestamp_ms: Date.now(),
      block_height: 0,
    });
    if (!schemaCheck.valid) {
      throw new Error(`invalid settlement event schema: ${schemaCheck.missing.join(",")}`);
    }

    return {
      traceId: crypto.randomUUID(),
      redemptionId: plan.redemptionId,
      gasBudgetMist: gasBudget,
      ptbSteps: steps,
      creditNoteMemo: creditNote.memo,
    };
  }

  /** L4 → L5 handoff: archive execution + plan Sui settlement ack. */
  async processL4Execution(
    result: ExecutionResult,
    plan: Omit<RedemptionPlan, "redemptionId"> & { readonly redemptionId?: string },
  ): Promise<OrchestratorOutcome | null> {
    if (!result.settled) return null;

    const redemptionId = plan.redemptionId ?? result.executionId.slice(2, 34);
    const outcome = await this.planRedemption({ ...plan, redemptionId });

    this.events.emit({
      schemaVersion: "v1.0.0",
      eventType: "L4_EXECUTION_ACK",
      redemptionId,
      kwh: plan.kwhClaim,
      consumerAddr: plan.consumer,
      producerAddr: plan.consumer,
      oracleSig: ZERO_HEX_32,
      timestampMs: Date.now(),
      blockHeight: result.confirmationBlock,
    });

    this.burns.recordBurn({
      amount: plan.kwhClaim * KWH_SCALE,
      redemptionId,
      consumer: plan.consumer,
      timestampMs: Date.now(),
    });

    return outcome;
  }
}
