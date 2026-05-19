import { CONFIRMATION_DEPTH } from "./types.js";

export type ConfirmationStatus = "pending" | "confirmed" | "reverted" | "stuck";

export interface ConfirmationTracker {
  readonly txHash: `0x${string}`;
  readonly submittedAtBlock: number;
  readonly requiredConfirmations: number;
  currentConfirmations: number;
  status: ConfirmationStatus;
}

/** Gate 4.7.1 — 12-block confirmation rule (vertical decomp §2.3) */
export function updateConfirmation(
  tracker: ConfirmationTracker,
  currentBlock: number,
  receipt: { blockNumber: bigint; status: "success" | "reverted" } | null,
): ConfirmationTracker {
  if (!receipt) {
    if (currentBlock - tracker.submittedAtBlock > 50) {
      return { ...tracker, status: "stuck" };
    }
    return tracker;
  }

  if (receipt.status === "reverted") {
    return { ...tracker, status: "reverted" };
  }

  const depth = currentBlock - Number(receipt.blockNumber);
  const next = { ...tracker, currentConfirmations: depth };
  if (depth >= tracker.requiredConfirmations) {
    return { ...next, status: "confirmed" };
  }
  return next;
}

export function createTracker(
  txHash: `0x${string}`,
  submittedAtBlock: number,
  requiredConfirmations = CONFIRMATION_DEPTH,
): ConfirmationTracker {
  return {
    txHash,
    submittedAtBlock,
    requiredConfirmations,
    currentConfirmations: 0,
    status: "pending",
  };
}
