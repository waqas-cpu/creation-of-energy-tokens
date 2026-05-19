import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { keccak256, toHex } from "viem";
import type { IpfsPinClient } from "../ipfs/ipfsPinClient.js";
import type { ExecutionResult } from "../types.js";
import { ensureDir, reportDir } from "./dataDir.js";

type ReportRecord = { cid: string; ipfsCid?: string; contractId: string };

export class IpfsRegulatoryReporter {
  constructor(
    private readonly root: string,
    private readonly ipfs: IpfsPinClient,
  ) {
    ensureDir(reportDir(root));
  }

  async generateReport(result: ExecutionResult): Promise<`0x${string}`> {
    const payload = {
      type: "FCA_MLR_EXECUTION_REPORT",
      contractId: result.contractId,
      txHash: result.txHash,
      settled: result.settled,
      gasUsed: result.gasUsed.toString(),
      timestamp: Date.now(),
    };

    let cid: `0x${string}`;
    let ipfsCid: string | undefined;
    if (this.ipfs.isEnabled()) {
      const pinned = await this.ipfs.pinJson(`report-${result.contractId}`, payload);
      cid = pinned.contentHash;
      ipfsCid = pinned.ipfsCid;
    } else {
      cid = keccak256(toHex(new TextEncoder().encode(JSON.stringify(payload)))) as `0x${string}`;
    }

    const safe = result.contractId.replace(/[^a-fA-F0-9x]/g, "_");
    const file = join(reportDir(this.root), `${safe}.json`);
    writeFileSync(file, JSON.stringify({ cid, ipfsCid, contractId: result.contractId }), "utf8");
    return cid;
  }

  getReport(contractId: string): `0x${string}` | undefined {
    const safe = contractId.replace(/[^a-fA-F0-9x]/g, "_");
    const file = join(reportDir(this.root), `${safe}.json`);
    if (!existsSync(file)) return undefined;
    const j = JSON.parse(readFileSync(file, "utf8")) as ReportRecord;
    return j.cid as `0x${string}`;
  }
}
