import { mkdirSync } from "node:fs";
import { join } from "node:path";

/** When set, audit / proof / report artifacts are written under this directory. */
export function settlementDataDir(): string | undefined {
  const d = process.env.SETTLEMENT_DATA_DIR?.trim();
  return d?.length ? d : undefined;
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function auditJsonlPath(root: string): string {
  return join(root, "audit.jsonl");
}

export function proofDir(root: string): string {
  return join(root, "proofs");
}

export function reportDir(root: string): string {
  return join(root, "reports");
}
