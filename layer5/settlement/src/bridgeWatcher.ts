/** Off-chain Wormhole VAA watcher (integration gates §4.4 rule 4). */
export class BridgeWatcher {
  private readonly pending = new Map<string, { startedAt: number; alerted: boolean }>();

  track(bridgeTxId: string): void {
    this.pending.set(bridgeTxId, { startedAt: Date.now(), alerted: false });
  }

  /** Returns bridge IDs stalled > 1h without VAA. */
  poll(nowMs = Date.now()): readonly string[] {
    const stalled: string[] = [];
    for (const [id, row] of this.pending) {
      if (nowMs - row.startedAt > 3_600_000 && !row.alerted) {
        stalled.push(id);
        row.alerted = true;
      }
    }
    return stalled;
  }

  confirm(bridgeTxId: string): void {
    this.pending.delete(bridgeTxId);
  }
}
