/**
 * UI pipeline: mirrors L3→L4→L5 flow by calling the settlement HTTP API
 * (same routes used by layer5/settlement and scripts/test-backend.mjs).
 */
import {
  loadClientConfig,
  settlementClient,
  type SettlementClientConfig,
} from "@/api/settlementClient";
import type {
  RedemptionDryRunRequest,
  SettlementProcessRequest,
} from "@/api/types";

export interface PipelineStatus {
  health: { ok: boolean; service: string } | null;
  gatesReady: boolean | null;
  network: string | null;
  auditCount: number;
  lastError: string | null;
}

export async function runPipelineHealthCheck(
  config: SettlementClientConfig = loadClientConfig(),
): Promise<PipelineStatus> {
  const status: PipelineStatus = {
    health: null,
    gatesReady: null,
    network: null,
    auditCount: 0,
    lastError: null,
  };

  try {
    status.health = await settlementClient.health(config);
    const gates = await settlementClient.gates(config);
    status.gatesReady = gates.ready;
    status.network = gates.network;
    const audit = await settlementClient.audit(config);
    status.auditCount = audit.records.length;
  } catch (e) {
    status.lastError = e instanceof Error ? e.message : String(e);
  }

  return status;
}

export async function pipelineRedemptionDryRun(
  plan: RedemptionDryRunRequest,
  config: SettlementClientConfig = loadClientConfig(),
) {
  return settlementClient.redemptionDryRun(config, plan);
}

export async function pipelineSettlementProcess(
  payload: SettlementProcessRequest,
  config: SettlementClientConfig = loadClientConfig(),
) {
  return settlementClient.settlementProcess(config, payload);
}
