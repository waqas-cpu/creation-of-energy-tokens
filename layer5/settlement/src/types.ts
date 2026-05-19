/** L4 → L5 interface (integration gates §5) */

export type ExecutionId = `0x${string}` & { readonly __brand: "ExecutionId" };
export type ContractId = `0x${string}` & { readonly __brand: "ContractId" };

export interface ExecutionResult {
  readonly contractId: ContractId;
  readonly executionId: ExecutionId;
  readonly txHash: `0x${string}`;
  readonly executionBlock: number;
  readonly confirmationBlock: number;
  readonly settled: boolean;
  readonly rollbackReason: `0x${string}`;
  readonly proofIds: readonly `0x${string}`[];
  readonly regulatoryReportCid: `0x${string}`;
  readonly gasUsed: bigint;
}

export interface AuditRecord {
  readonly contractId: ContractId;
  readonly executionId: ExecutionId;
  readonly txHash: `0x${string}`;
  readonly archivedAt: number;
  readonly proofCid: `0x${string}`;
  readonly reportCid: `0x${string}`;
  readonly gasUsed: bigint;
  readonly confirmationDepth: number;
}
