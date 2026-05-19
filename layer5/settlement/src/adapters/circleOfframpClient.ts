import { loadNetworkManifest } from "../config/loadNetworkManifest.js";
import { log } from "../observability/logger.js";

export interface OfframpQuote {
  readonly usdcIn: bigint;
  readonly feeBps: bigint;
  readonly payout: bigint;
}

export interface OfframpResult {
  readonly reference: string;
  readonly status: "pending" | "completed" | "failed";
}

const MAX_FEE_BPS = 500n;

/** Circle / CCTP off-ramp (gate 5.8 — RULE-5.8-E requires human 2FA before fiat). */
export class CircleOfframpClient {
  private readonly apiBase: string;
  private readonly apiKey: string | undefined;

  constructor(network = process.env.SUI_NETWORK) {
    const manifest = loadNetworkManifest(network);
    this.apiBase = manifest.apis.circleApi;
    this.apiKey = process.env.CIRCLE_API_KEY;
  }

  quote(usdcIn: bigint, feeBps: bigint): OfframpQuote {
    const capped = feeBps > MAX_FEE_BPS ? MAX_FEE_BPS : feeBps;
    const fee = (usdcIn * capped) / 10_000n;
    return { usdcIn, feeBps: capped, payout: usdcIn - fee };
  }

  /**
   * Initiate USDC transfer via Circle APIs when `CIRCLE_API_KEY` is set.
   * Fiat conversion requires explicit `humanApproved: true` (RULE-5.8-E).
   */
  async convertToFiat(
    usdcAmount: bigint,
    destinationIban: string,
    humanApproved: boolean,
  ): Promise<OfframpResult> {
    if (!humanApproved) {
      throw new Error("Off-ramp blocked: human 2FA approval required (RULE-5.8-E)");
    }
    if (!this.apiKey) {
      log("warn", "circle_api_key_missing_simulated_offramp", { usdcAmount: usdcAmount.toString() });
      return { reference: `sim-cctp-${usdcAmount}`, status: "pending" };
    }
    const res = await fetch(`${this.apiBase}/v1/transfers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        amount: { amount: usdcAmount.toString(), currency: "USD" },
        destination: { type: "wire", id: destinationIban },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      log("error", "circle_offramp_failed", { status: res.status, body: text });
      return { reference: `failed-${Date.now()}`, status: "failed" };
    }
    const body = (await res.json()) as { data?: { id?: string; status?: string } };
    log("info", "circle_offramp_submitted", { id: body.data?.id });
    return {
      reference: body.data?.id ?? `circle-${Date.now()}`,
      status: body.data?.status === "complete" ? "completed" : "pending",
    };
  }
}
