import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { keccak256, toHex } from "viem";
import type { IpfsPinClient } from "../ipfs/ipfsPinClient.js";
import type { ExecutionId, ExecutionResult } from "../types.js";
import { ensureDir, proofDir } from "./dataDir.js";

type ProofRecord = {
  cid: string;
  ipfsCid?: string;
  executionId: string;
  txHash: string;
};

/** Disk index + IPFS pin for ZK / execution proofs (gate 4.8.3). */
export class IpfsProofArchive {
  constructor(
    private readonly root: string,
    private readonly ipfs: IpfsPinClient,
  ) {
    ensureDir(proofDir(root));
  }

  async archive(result: ExecutionResult): Promise<`0x${string}`> {
    const payload = {
      executionId: result.executionId,
      txHash: result.txHash,
      contractId: result.contractId,
      gasUsed: result.gasUsed.toString(),
      archivedAt: Date.now(),
    };

    let cid: `0x${string}`;
    let ipfsCid: string | undefined;
    if (this.ipfs.isEnabled()) {
      const pinned = await this.ipfs.pinJson(`proof-${result.executionId}`, payload);
      cid = pinned.contentHash;
      ipfsCid = pinned.ipfsCid;
    } else {
      const hex = toHex(new TextEncoder().encode(JSON.stringify(payload)));
      cid = keccak256(hex) as `0x${string}`;
    }

    const file = join(proofDir(this.root), `${result.executionId}.json`);
    writeFileSync(
      file,
      JSON.stringify({ cid, ipfsCid, executionId: result.executionId, txHash: result.txHash }),
      "utf8",
    );
    return cid;
  }

  get(executionId: ExecutionId): `0x${string}` | undefined {
    const file = join(proofDir(this.root), `${executionId}.json`);
    if (!existsSync(file)) return undefined;
    const j = JSON.parse(readFileSync(file, "utf8")) as ProofRecord;
    return j.cid as `0x${string}`;
  }

  getIpfsCid(executionId: ExecutionId): string | undefined {
    const file = join(proofDir(this.root), `${executionId}.json`);
    if (!existsSync(file)) return undefined;
    const j = JSON.parse(readFileSync(file, "utf8")) as ProofRecord;
    return j.ipfsCid;
  }
}
