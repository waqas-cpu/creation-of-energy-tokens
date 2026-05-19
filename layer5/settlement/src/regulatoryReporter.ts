import { keccak256, toHex } from "viem";
import type { AuditRecord, ExecutionResult } from "./types.js";

/** Gate 4.8.4 — regulatory report (must not block settlement indefinitely) */
export class RegulatoryReporter {
  private readonly reports = new Map<string, `0x${string}`>();

  async generateReport(result: ExecutionResult): Promise<`0x${string}`> {
    const payload = toHex(
      new TextEncoder().encode(
        JSON.stringify({
          type: "FCA_MLR_EXECUTION_REPORT",
          contractId: result.contractId,
          txHash: result.txHash,
          settled: result.settled,
          gasUsed: result.gasUsed.toString(),
          timestamp: Date.now(),
        }),
      ),
    );
    const cid = keccak256(payload) as `0x${string}`;
    this.reports.set(result.contractId, cid);
    return cid;
  }

  getReport(contractId: string): `0x${string}` | undefined {
    return this.reports.get(contractId);
  }
}
