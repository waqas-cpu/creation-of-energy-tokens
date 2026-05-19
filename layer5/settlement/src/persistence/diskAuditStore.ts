import { appendFileSync, readFileSync, existsSync } from "node:fs";
import type { AuditRecord } from "../types.js";
import { auditJsonlPath, ensureDir } from "./dataDir.js";

export class DiskAuditStore {
  constructor(private readonly root: string) {
    ensureDir(root);
  }

  append(record: AuditRecord): void {
    appendFileSync(auditJsonlPath(this.root), `${JSON.stringify(serializeRecord(record))}\n`, "utf8");
  }

  list(): readonly AuditRecord[] {
    const p = auditJsonlPath(this.root);
    if (!existsSync(p)) return [];
    const lines = readFileSync(p, "utf8").split("\n").filter(Boolean);
    return lines.map((line) => deserializeRecord(JSON.parse(line) as SerializedAudit));
  }

  findByContract(contractId: string): readonly AuditRecord[] {
    return this.list().filter((r) => r.contractId === contractId);
  }
}

type SerializedAudit = {
  contractId: string;
  executionId: string;
  txHash: string;
  archivedAt: number;
  proofCid: string;
  reportCid: string;
  gasUsed: string;
  confirmationDepth: number;
};

function serializeRecord(r: AuditRecord): SerializedAudit {
  return {
    contractId: r.contractId,
    executionId: r.executionId,
    txHash: r.txHash,
    archivedAt: r.archivedAt,
    proofCid: r.proofCid,
    reportCid: r.reportCid,
    gasUsed: r.gasUsed.toString(),
    confirmationDepth: r.confirmationDepth,
  };
}

function deserializeRecord(s: SerializedAudit): AuditRecord {
  return {
    contractId: s.contractId as AuditRecord["contractId"],
    executionId: s.executionId as AuditRecord["executionId"],
    txHash: s.txHash as AuditRecord["txHash"],
    archivedAt: s.archivedAt,
    proofCid: s.proofCid as AuditRecord["proofCid"],
    reportCid: s.reportCid as AuditRecord["reportCid"],
    gasUsed: BigInt(s.gasUsed),
    confirmationDepth: s.confirmationDepth,
  };
}
