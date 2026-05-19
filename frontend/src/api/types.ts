export interface HealthResponse {
  ok: boolean;
  service: string;
}

export type GateStatus = "pass" | "fail" | "warn" | "skip";

export interface GateItem {
  id: string;
  name: string;
  status: GateStatus;
  detail: string;
}

export interface GateChecklistResponse {
  network: string;
  ready: boolean;
  blockers: number;
  warnings: number;
  gates: GateItem[];
}

export interface AuditRecord {
  contractId: string;
  executionId: string;
  txHash: string;
  archivedAt: number;
  proofCid: string;
  reportCid: string;
  gasUsed: string | number;
  confirmationDepth: number;
}

export interface AuditListResponse {
  records: AuditRecord[];
}

export interface RedemptionDryRunRequest {
  consumer: string;
  kwhClaim: string;
  coinBalanceMicro?: string;
  batchKwh?: string;
  batchRedeemed?: boolean;
}

export interface RedemptionDryRunResponse {
  dryRun: { success: boolean; gasUsed?: string };
  outcome?: unknown;
}

export interface SettlementProcessRequest {
  contractId: string;
  executionId: string;
  txHash: string;
  executionBlock: number;
  confirmationBlock: number;
  settled: boolean;
  rollbackReason: string;
  gasUsed: string;
  options?: {
    consumer?: string;
    kwhClaim?: string;
  };
}

export interface SettlementProcessResponse {
  acknowledged: boolean;
}

export interface ApiErrorBody {
  error: string;
}
