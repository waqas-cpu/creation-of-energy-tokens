import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { keccak256, toHex } from "viem";
import type { ExecutionId, ExecutionResult } from "../types.js";
import { ensureDir, proofDir } from "./dataDir.js";

/** File-backed proof CID store (one JSON file per execution). */
export class DiskZkProofArchive {
  constructor(private readonly root: string) {
    ensureDir(proofDir(root));
  }

  async archive(result: ExecutionResult): Promise<`0x${string}`> {
    const payload = toHex(
      new TextEncoder().encode(
        JSON.stringify({
          executionId: result.executionId,
          txHash: result.txHash,
          contractId: result.contractId,
        }),
      ),
    );
    const cid = keccak256(payload) as `0x${string}`;
    const file = join(proofDir(this.root), `${result.executionId}.json`);
    writeFileSync(
      file,
      JSON.stringify({ cid, executionId: result.executionId, txHash: result.txHash }, null, 0),
      "utf8",
    );
    return cid;
  }

  get(executionId: ExecutionId): `0x${string}` | undefined {
    const file = join(proofDir(this.root), `${executionId}.json`);
    if (!existsSync(file)) return undefined;
    const j = JSON.parse(readFileSync(file, "utf8")) as { cid: string };
    return j.cid as `0x${string}`;
  }
}
