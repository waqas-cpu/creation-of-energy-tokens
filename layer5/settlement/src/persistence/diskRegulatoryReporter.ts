import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { keccak256, toHex } from "viem";
import type { ExecutionResult } from "../types.js";
import { ensureDir, reportDir } from "./dataDir.js";

export class DiskRegulatoryReporter {
  constructor(private readonly root: string) {
    ensureDir(reportDir(root));
  }

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
    const safe = result.contractId.replace(/[^a-fA-F0-9x]/g, "_");
    const file = join(reportDir(this.root), `${safe}.json`);
    writeFileSync(file, JSON.stringify({ cid, contractId: result.contractId }, null, 0), "utf8");
    return cid;
  }

  getReport(contractId: string): `0x${string}` | undefined {
    const safe = contractId.replace(/[^a-fA-F0-9x]/g, "_");
    const file = join(reportDir(this.root), `${safe}.json`);
    if (!existsSync(file)) return undefined;
    const j = JSON.parse(readFileSync(file, "utf8")) as { cid: string };
    return j.cid as `0x${string}`;
  }
}
