import { resolveSigner } from "./signing/multisigSigner.js";
import { log } from "./observability/logger.js";
import { Transaction } from "@mysten/sui/transactions";
import type { RedemptionPlan } from "./settlementOrchestrator.js";
import {
  buildLayer5RedeemPtb,
  redemptionIdBytes,
  type Layer5PackageTargets,
  type Layer5RedeemObjects,
} from "./buildRedeemPtb.js";
import { isStubPackageId, loadPublishedDeploymentOrStub } from "./publishedIds.js";
import { createSuiClientForRpc, resolveSuiRpcUrl, type SuiRpcNetwork } from "./suiRpcClient.js";

export interface SuiPtbConfig {
  readonly packageId: string;
  readonly l3GridPackageId?: string;
  readonly network: "localnet" | "testnet" | "mainnet";
  readonly rpcUrl?: string;
  /** When set, `submit` signs and executes on RPC. Hex or base64 secret key. */
  readonly signerSecretKey?: string;
  readonly objects?: Layer5RedeemObjects;
  /** Force stub dry-run (default: auto when packageId is placeholder). */
  readonly stub?: boolean;
}

export interface DryRunResult {
  readonly success: boolean;
  readonly gasUsed: bigint;
  readonly effects: readonly string[];
  readonly status?: string;
}

function rpcUrlFor(config: SuiPtbConfig): string {
  if (config.rpcUrl) return config.rpcUrl;
  const dep = loadPublishedDeploymentOrStub(config.packageId);
  if (dep?.rpcUrl) return dep.rpcUrl;
  return resolveSuiRpcUrl(config.network as SuiRpcNetwork);
}

function resolveTargets(config: SuiPtbConfig): Layer5PackageTargets {
  const published = loadPublishedDeploymentOrStub(config.packageId);
  if (published) {
    return published.targets;
  }
  return {
    l5PackageId: config.packageId,
    l3GridPackageId: config.l3GridPackageId ?? config.packageId,
  };
}

function resolveObjects(config: SuiPtbConfig): Layer5RedeemObjects | undefined {
  if (config.objects) return config.objects;
  return loadPublishedDeploymentOrStub(config.packageId)?.objects;
}

/**
 * Gate 5.5-B — PTB builder with dry-run simulation (RULE-5.5-A..E).
 */
export class SuiPtbClient {
  constructor(private readonly config: SuiPtbConfig) {}

  private useStub(): boolean {
    if (this.config.stub === true) return true;
    if (this.config.stub === false) return false;
    return isStubPackageId(this.config.packageId) || !resolveObjects(this.config);
  }

  buildRedeemTransaction(plan: RedemptionPlan): Transaction {
    const targets = resolveTargets(this.config);
    const objects = resolveObjects(this.config);
    if (!objects) {
      throw new Error("Layer5RedeemObjects required for PTB build (set env or config.objects)");
    }
    const tx = new Transaction();
    buildLayer5RedeemPtb(tx, targets, objects, {
      redemptionId: redemptionIdBytes(plan.redemptionId),
      kwh: plan.kwhClaim,
      billingPeriodEndMs: BigInt(plan.billingPeriodEndMs),
      billingPeriodOverride: false,
      usdcEquiv: 0n,
    });
    return tx;
  }

  buildRedeemPtbSteps(plan: RedemptionPlan): readonly string[] {
    const targets = resolveTargets(this.config);
    return [
      `${targets.l5PackageId}::redemption_orchestrator::redeem_atomic`,
    ];
  }

  async dryRun(plan: RedemptionPlan): Promise<DryRunResult> {
    const steps = this.buildRedeemPtbSteps(plan);

    if (this.useStub()) {
      const gasUsed = 1_000_000n + BigInt(steps.length) * 2_000_000n;
      return { success: true, gasUsed, effects: steps };
    }

    const client = createSuiClientForRpc(this.config.network as SuiRpcNetwork, rpcUrlFor(this.config));
    const tx = this.buildRedeemTransaction(plan);
    const sender = plan.consumer;
    const result = await client.devInspectTransactionBlock({
      transactionBlock: tx,
      sender,
    });

    const status = result.effects?.status?.status ?? "unknown";
    const success = status === "success";
    const gasUsed = result.effects?.gasUsed
      ? BigInt(result.effects.gasUsed.computationCost) +
        BigInt(result.effects.gasUsed.storageCost)
      : 1_000_000n;

    return {
      success,
      gasUsed,
      effects: steps,
      status,
    };
  }

  async submit(plan: RedemptionPlan): Promise<{ readonly digest: string }> {
    const dry = await this.dryRun(plan);
    if (!dry.success) {
      throw new Error(`PTB dry-run failed: ${dry.status ?? "unknown"}`);
    }

    if (this.useStub()) {
      return { digest: `0x${"ab".repeat(32)}` };
    }

    if (this.config.signerSecretKey) {
      process.env.SUI_SIGNER_SECRET_KEY = this.config.signerSecretKey;
    }
    const client = createSuiClientForRpc(this.config.network as SuiRpcNetwork, rpcUrlFor(this.config));
    const tx = this.buildRedeemTransaction(plan);
    const signer = resolveSigner();
    const { digest } = await client.signAndExecuteTransaction({
      transaction: tx,
      signer,
      options: { showEffects: true },
    });
    log("info", "ptb_submitted", { digest, network: this.config.network });
    return { digest };
  }
}
