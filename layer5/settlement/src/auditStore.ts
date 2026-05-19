import type { AuditRecord, ExecutionResult } from "./types.js";

/** Immutable audit trail for regulators / Layer 5 queries */
export class AuditStore {
  private readonly records: AuditRecord[] = [];

  append(record: AuditRecord): void {
    this.records.push(record);
  }

  list(): readonly AuditRecord[] {
    return this.records;
  }

  findByContract(contractId: string): readonly AuditRecord[] {
    return this.records.filter((r) => r.contractId === contractId);
  }
}

export function auditRecordFromResult(
  result: ExecutionResult,
  proofCid: `0x${string}`,
  reportCid: `0x${string}`,
): AuditRecord {
  return {
    contractId: result.contractId,
    executionId: result.executionId,
    txHash: result.txHash,
    archivedAt: Date.now(),
    proofCid,
    reportCid,
    gasUsed: result.gasUsed,
    confirmationDepth: result.confirmationBlock - result.executionBlock,
  };
}
