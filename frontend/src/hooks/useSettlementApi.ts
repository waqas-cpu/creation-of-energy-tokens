import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadClientConfig, settlementClient } from "@/api/settlementClient";
import { runPipelineHealthCheck, pipelineRedemptionDryRun, pipelineSettlementProcess } from "@/pipeline/settlementPipeline";
import type { RedemptionDryRunRequest, SettlementProcessRequest } from "@/api/types";

export function useSettlementConfig() {
  return loadClientConfig();
}

export function usePipelineStatus() {
  const config = loadClientConfig();
  return useQuery({
    queryKey: ["pipeline-status", config.baseUrl],
    queryFn: () => runPipelineHealthCheck(config),
    refetchInterval: 15_000,
  });
}

export function useGates() {
  const config = loadClientConfig();
  return useQuery({
    queryKey: ["gates", config.baseUrl],
    queryFn: () => settlementClient.gates(config),
  });
}

export function useAudit() {
  const config = loadClientConfig();
  return useQuery({
    queryKey: ["audit", config.baseUrl],
    queryFn: () => settlementClient.audit(config),
  });
}

export function useRedemptionDryRun() {
  const qc = useQueryClient();
  const config = loadClientConfig();
  return useMutation({
    mutationFn: (body: RedemptionDryRunRequest) => pipelineRedemptionDryRun(body, config),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit"] }),
  });
}

export function useSettlementProcess() {
  const qc = useQueryClient();
  const config = loadClientConfig();
  return useMutation({
    mutationFn: (body: SettlementProcessRequest) => pipelineSettlementProcess(body, config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["pipeline-status"] });
    },
  });
}
