import { SuiClient, SuiHTTPTransport, type HttpHeaders, getFullnodeUrl } from "@mysten/sui/client";

export type SuiRpcNetwork = "mainnet" | "testnet" | "localnet";

/**
 * JSON-RPC URL (Mysten fullnode, Shinami `https://api.*.shinami.com/sui/node/v1`, etc.).
 * Prefer `SUI_RPC_URL`; optional `SHINAMI_NODE_URL` alias for docs compatibility.
 */
export function resolveSuiRpcUrl(network: SuiRpcNetwork, override?: string): string {
  if (override?.trim()) return override.trim();
  const fromEnv =
    process.env.SUI_RPC_URL?.trim() ||
    process.env.SHINAMI_NODE_URL?.trim() ||
    process.env.SHINAMI_SUI_NODE_URL?.trim() ||
    process.env.BLOCKVISION_RPC_URL?.trim();
  if (fromEnv) return fromEnv;
  if (network === "mainnet") return getFullnodeUrl("mainnet");
  if (network === "localnet") return getFullnodeUrl("localnet");
  return getFullnodeUrl("testnet");
}

/** Shinami / custom RPC auth — sent as `X-Api-Key` (see Shinami docs). */
export function resolveSuiRpcHeaders(): HttpHeaders | undefined {
  const key =
    process.env.SUI_RPC_API_KEY?.trim() ||
    process.env.SHINAMI_API_KEY?.trim() ||
    process.env.SHINAMI_ACCESS_KEY?.trim();
  if (!key) return undefined;
  return { "X-Api-Key": key };
}

export function createSuiClientForRpc(network: SuiRpcNetwork, rpcUrlOverride?: string): SuiClient {
  const url = resolveSuiRpcUrl(network, rpcUrlOverride);
  const extra = resolveSuiRpcHeaders();
  if (extra && Object.keys(extra).length > 0) {
    return new SuiClient({
      transport: new SuiHTTPTransport({
        url,
        rpc: { url, headers: extra },
      }),
    });
  }
  return new SuiClient({ url });
}
