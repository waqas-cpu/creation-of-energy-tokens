import { keccak256, toHex } from "viem";
import type { ExecutionId, ExecutionResult } from "./types.js";

/** Gate 4.8.3 — ZK proof archive (IPFS/Filecoin stub) */
export class ZKProofArchive {
  private readonly store = new Map<ExecutionId, `0x${string}`>();

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
    this.store.set(result.executionId, cid);
    return cid;
  }

  get(executionId: ExecutionId): `0x${string}` | undefined {
    return this.store.get(executionId);
  }
}
