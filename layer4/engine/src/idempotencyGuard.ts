import type { ExecutionId } from "./types.js";

export type ExecutionRecordStatus =
  | "QUEUED"
  | "SUBMITTED"
  | "CONFIRMING"
  | "FINALIZED"
  | "FAILED";

export interface ExecutionRecord {
  readonly executionId: ExecutionId;
  readonly status: ExecutionRecordStatus;
  readonly txHash?: `0x${string}`;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** In-memory idempotency guard (Lane SFT) — production uses PostgreSQL/Redis per horizontal decomp */
export class IdempotencyGuard {
  private readonly store = new Map<string, ExecutionRecord>();

  check(executionId: ExecutionId): ExecutionRecord | undefined {
    return this.store.get(executionId);
  }

  assertNotInFlight(executionId: ExecutionId): void {
    const existing = this.store.get(executionId);
    if (
      existing &&
      (existing.status === "SUBMITTED" ||
        existing.status === "CONFIRMING" ||
        existing.status === "FINALIZED")
    ) {
      throw new Error(`Layer4: execution in flight (${existing.status})`);
    }
  }

  record(executionId: ExecutionId, status: ExecutionRecordStatus, txHash?: `0x${string}`): void {
    const now = Date.now();
    const prev = this.store.get(executionId);
    this.store.set(executionId, {
      executionId,
      status,
      txHash: txHash ?? prev?.txHash,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    });
  }
}
