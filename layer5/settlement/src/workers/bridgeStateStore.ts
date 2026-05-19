import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type BridgePendingRow = {
  readonly bridgeTxId: string;
  readonly emitterChain: number;
  readonly emitterAddress: string;
  readonly sequence: number;
  readonly startedAt: number;
  alerted: boolean;
};

export class BridgeStateStore {
  constructor(private readonly root: string) {
    mkdirSync(join(root, "bridges"), { recursive: true });
  }

  private filePath(): string {
    return join(this.root, "bridges", "pending.json");
  }

  load(): BridgePendingRow[] {
    const p = this.filePath();
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, "utf8")) as BridgePendingRow[];
  }

  save(rows: BridgePendingRow[]): void {
    writeFileSync(this.filePath(), JSON.stringify(rows, null, 0), "utf8");
  }

  track(row: Omit<BridgePendingRow, "alerted">): void {
    const rows = this.load().filter((r) => r.bridgeTxId !== row.bridgeTxId);
    rows.push({ ...row, alerted: false });
    this.save(rows);
  }

  confirm(bridgeTxId: string): void {
    this.save(this.load().filter((r) => r.bridgeTxId !== bridgeTxId));
  }
}
