import {
  SettlementOrchestrator,
  SuiPtbClient,
  hasPublishedDeployment,
  loadPublishedDeployment,
} from "@sui-energy/layer5-settlement";
import type { ExecutionResult } from "@sui-energy/layer5-settlement";

export interface SuiRedemptionHookConfig {
  readonly packageId: string;
  readonly consumer: string;
  readonly kwhClaim: bigint;
}

/** Optional post-L4 Sui redemption planning (gates 5.5, 5.1). */
export async function planSuiRedemptionAfterL4(
  result: ExecutionResult,
  config: SuiRedemptionHookConfig,
): Promise<{ readonly digest?: string; readonly traceId?: string }> {
  if (!result.settled) return {};

  const published = hasPublishedDeployment() ? loadPublishedDeployment() : null;
  const orchestrator = new SettlementOrchestrator(
    published
      ? {
          packageId: published.targets.l5PackageId,
          l3GridPackageId: published.targets.l3GridPackageId,
          network: published.network,
          rpcUrl: published.rpcUrl,
          objects: published.objects,
        }
      : { packageId: config.packageId, network: "localnet", stub: true },
  );
  const plan = await orchestrator.processL4Execution(result, {
    consumer: config.consumer,
    kwhClaim: config.kwhClaim,
    coinBalanceMicro: config.kwhClaim * 1_000_000n,
    batchKwh: config.kwhClaim,
    batchRedeemed: false,
    billingPeriodEndMs: Date.now(),
  });

  const client = published
    ? new SuiPtbClient({
        packageId: published.targets.l5PackageId,
        l3GridPackageId: published.targets.l3GridPackageId,
        network: published.network,
        rpcUrl: published.rpcUrl,
        objects: published.objects,
      })
    : new SuiPtbClient({ packageId: config.packageId, network: "localnet", stub: true });
  const submitted = plan
    ? await client.submit({
        redemptionId: plan.redemptionId,
        consumer: config.consumer,
        kwhClaim: config.kwhClaim,
        coinBalanceMicro: config.kwhClaim * 1_000_000n,
        batchKwh: config.kwhClaim,
        batchRedeemed: false,
        billingPeriodEndMs: Date.now(),
      })
    : undefined;

  return { digest: submitted?.digest, traceId: plan?.traceId };
}
