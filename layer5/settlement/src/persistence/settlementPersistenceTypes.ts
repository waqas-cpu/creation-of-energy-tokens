import type { AuditRecord, ExecutionId, ExecutionResult } from "../types.js";

export interface SettlementAudit {
  append(record: AuditRecord): void;
  list(): readonly AuditRecord[];
  findByContract(contractId: string): readonly AuditRecord[];
}

export interface SettlementArchive {
  archive(result: ExecutionResult): Promise<`0x${string}`>;
  get(executionId: ExecutionId): `0x${string}` | undefined;
}

export interface SettlementReporter {
  generateReport(result: ExecutionResult): Promise<`0x${string}`>;
  getReport(contractId: string): `0x${string}` | undefined;
}
