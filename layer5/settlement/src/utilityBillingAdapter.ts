export interface CreditNotePayload {
  readonly consumer: string;
  readonly kwh: bigint;
  readonly redemptionId: string;
  readonly periodEndMs: number;
  readonly memo: string;
  readonly issuedAt: number;
}

/** Module 5.6 — utility billing adapter (RULE-5.6-A..E). */
export class UtilityBillingAdapter {
  private readonly notes = new Map<string, string>();

  issueCreditNote(input: {
    readonly consumer: string;
    readonly kwh: bigint;
    readonly redemptionId: string;
    readonly periodEndMs: number;
  }): CreditNotePayload {
    const date = new Date(input.periodEndMs).toISOString().slice(0, 10);
    const memo = `Energy token redemption: ${input.kwh} kWh for period ending ${date}. Redemption ID: ${input.redemptionId}`;
    const noteId = `cn-${input.redemptionId}`;
    this.notes.set(input.redemptionId, noteId);
    return {
      consumer: input.consumer,
      kwh: input.kwh,
      redemptionId: input.redemptionId,
      periodEndMs: input.periodEndMs,
      memo,
      issuedAt: Date.now(),
    };
  }

  reconcile(onChainBurns: ReadonlyArray<{ redemptionId: string; kwh: bigint }>): {
    matched: number;
    unmatched: number;
  } {
    let matched = 0;
    let unmatched = 0;
    for (const burn of onChainBurns) {
      if (this.notes.has(burn.redemptionId)) matched++;
      else unmatched++;
    }
    return { matched, unmatched };
  }
}
