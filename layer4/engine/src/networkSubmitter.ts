import type { Hash, PublicClient, WalletClient } from "viem";
import { keccak256, toHex } from "viem";
import type { TransactionRequest } from "./types.js";
import { MAX_RETRIES } from "./types.js";

export type SubmitMode = "simulation" | "live" | "safe";

export interface SubmitResult {
  readonly txHash: Hash;
  readonly submittedAtBlock: number;
}

export class NetworkSubmitter {
  constructor(
    private readonly mode: SubmitMode,
    private readonly publicClient?: PublicClient,
    private readonly walletClient?: WalletClient,
  ) {}

  async submit(tx: TransactionRequest, retry = 0): Promise<SubmitResult> {
    if (this.mode === "simulation") {
      const payload = toHex(
        new TextEncoder().encode(
          JSON.stringify({
            to: tx.to,
            data: tx.data.slice(0, 66),
            nonce: tx.nonce,
            retry,
          }),
        ),
      );
      return {
        txHash: keccak256(payload),
        submittedAtBlock: 1_000_000,
      };
    }

    if (!this.walletClient?.account || !this.publicClient) {
      throw new Error("Layer4 NET: live mode requires wallet + public client");
    }

    const hash = await this.walletClient.sendTransaction({
      account: this.walletClient.account,
      chain: this.walletClient.chain,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gas: tx.gasLimit,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      nonce: tx.nonce,
      type: "eip1559",
    });

    const block = await this.publicClient.getBlockNumber();
    return { txHash: hash, submittedAtBlock: Number(block) };
  }

  async submitWithRetry(tx: TransactionRequest): Promise<SubmitResult> {
    let lastError: unknown;
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        return await this.submit(tx, i);
      } catch (e) {
        lastError = e;
        tx = {
          ...tx,
          maxFeePerGas: (tx.maxFeePerGas * 125n) / 100n,
          maxPriorityFeePerGas: (tx.maxPriorityFeePerGas * 125n) / 100n,
        };
      }
    }
    throw lastError ?? new Error("Layer4 NET: max retries exhausted");
  }
}
