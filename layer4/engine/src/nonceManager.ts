import type { Address, PublicClient } from "viem";
import { readSafeNonce } from "./safeAuth.js";

/** Lane NET — relayer nonce; Safe nonce read fresh per gate 4.5.5 */
export class NonceManager {
  private readonly nonces = new Map<string, number>();

  next(address: `0x${string}`): number {
    const current = this.nonces.get(address) ?? 0;
    this.nonces.set(address, current + 1);
    return current;
  }

  /** Gate 4.5.5 — never cache; fetch from Safe at execution time (Safe execTransaction path) */
  async nextFromSafe(publicClient: PublicClient, safeAddress: Address): Promise<number> {
    return readSafeNonce(publicClient, safeAddress);
  }

  /** Relayer EOA nonce for direct engine calls (fresh read, not cached) */
  async nextFromChain(publicClient: PublicClient, address: Address): Promise<number> {
    return publicClient.getTransactionCount({ address });
  }

  reconcile(address: `0x${string}`, chainNonce: number): void {
    const local = this.nonces.get(address) ?? 0;
    this.nonces.set(address, Math.max(local, chainNonce));
  }
}