import type {
  ApiErrorBody,
  AuditListResponse,
  GateChecklistResponse,
  HealthResponse,
  RedemptionDryRunRequest,
  RedemptionDryRunResponse,
  SettlementProcessRequest,
  SettlementProcessResponse,
} from "./types";

export interface SettlementClientConfig {
  baseUrl: string;
  apiKey: string;
}

const CONFIG_KEY = "sui-energy.settlement.config";

export function loadClientConfig(): SettlementClientConfig {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as SettlementClientConfig;
    } catch {
      /* use defaults */
    }
  }
  return {
    baseUrl:
      import.meta.env.VITE_SETTLEMENT_API_URL?.trim() || "/settlement-api",
    apiKey: import.meta.env.VITE_SETTLEMENT_API_KEY?.trim() || "",
  };
}

export function saveClientConfig(config: SettlementClientConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export class SettlementApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | string,
  ) {
    super(typeof body === "string" ? body : body.error);
    this.name = "SettlementApiError";
  }
}

async function request<T>(
  config: SettlementClientConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (config.apiKey) {
    headers["X-Settlement-Api-Key"] = config.apiKey;
  }

  const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    throw new SettlementApiError(
      res.status,
      typeof data === "object" && data && "error" in data
        ? (data as ApiErrorBody)
        : String(data),
    );
  }

  return data as T;
}

export const settlementClient = {
  health(config: SettlementClientConfig) {
    return request<HealthResponse>(config, "/health");
  },

  gates(config: SettlementClientConfig) {
    return request<GateChecklistResponse>(config, "/v1/gates");
  },

  audit(config: SettlementClientConfig) {
    return request<AuditListResponse>(config, "/audit");
  },

  redemptionDryRun(config: SettlementClientConfig, body: RedemptionDryRunRequest) {
    return request<RedemptionDryRunResponse>(config, "/v1/redemption/dry-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  settlementProcess(config: SettlementClientConfig, body: SettlementProcessRequest) {
    return request<SettlementProcessResponse>(config, "/v1/settlement/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
};
