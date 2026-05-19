import { log } from "../observability/logger.js";

export interface ErpCreditNotePayload {
  readonly consumer: string;
  readonly kwh: bigint;
  readonly redemptionId: string;
  readonly memo: string;
}

export interface ErpSyncResult {
  readonly ok: boolean;
  readonly externalId: string;
  readonly statusCode: number;
}

/** Gate 5.6 — grid operator ERP sync (RULE-5.6-A untrusted payloads). */
export class GridOperatorClient {
  private readonly delivered = new Map<string, ErpSyncResult>();

  async syncWithErp(
    apiUrl: string,
    note: ErpCreditNotePayload,
    idempotencyKey: string,
  ): Promise<ErpSyncResult> {
    const cached = this.delivered.get(idempotencyKey);
    if (cached) return cached;

    const apiKey = process.env.GRID_OPERATOR_API_KEY;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/credit-notes`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          consumer: note.consumer,
          kwh: note.kwh.toString(),
          redemption_id: note.redemptionId,
          memo: note.memo,
        }),
      });
      const externalId = res.headers.get("x-request-id") ?? `erp-${idempotencyKey.slice(0, 16)}`;
      const result: ErpSyncResult = {
        ok: res.ok,
        externalId,
        statusCode: res.status,
      };
      if (res.ok) {
        this.delivered.set(idempotencyKey, result);
      }
      log(res.ok ? "info" : "warn", "grid_erp_sync", {
        statusCode: res.status,
        redemptionId: note.redemptionId,
      });
      return result;
    } catch (err) {
      log("error", "grid_erp_sync_failed", {
        error: err instanceof Error ? err.message : String(err),
        redemptionId: note.redemptionId,
      });
      return { ok: false, externalId: "error", statusCode: 0 };
    } finally {
      clearTimeout(timeout);
    }
  }
}
