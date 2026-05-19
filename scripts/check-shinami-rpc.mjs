#!/usr/bin/env node
/**
 * Load repo-root `.env` for this process only. Does not print secrets.
 * Supports Shinami (SUI_RPC_*) and Blockvision (BLOCKVISION_RPC_*).
 * Usage: node scripts/check-shinami-rpc.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

const PUBLIC_TESTNET_RPC = "https://fullnode.testnet.sui.io:443";

function loadDotEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim().replace(/^\uFEFF/, "");
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function providerFromUrl(url) {
  if (url.includes("quiknode.pro")) return "quicknode";
  if (url.includes("shinami.com")) return "shinami";
  if (url.includes("blockvision")) return "blockvision";
  return "custom";
}

function pickRpcConfig(env) {
  const rpcUrl =
    env.SUI_RPC_URL?.trim() ||
    env.SHINAMI_NODE_URL?.trim() ||
    env.SHINAMI_SUI_NODE_URL?.trim();
  if (rpcUrl) {
    const provider = providerFromUrl(rpcUrl);
    return {
      provider,
      url: rpcUrl,
      apiKey:
        provider === "shinami"
          ? env.SUI_RPC_API_KEY?.trim() ||
            env.SHINAMI_API_KEY?.trim() ||
            env.SHINAMI_ACCESS_KEY?.trim() ||
            ""
          : "",
    };
  }

  const blockvisionUrl = env.BLOCKVISION_RPC_URL?.trim();
  if (blockvisionUrl) {
    return {
      provider: "blockvision",
      url: blockvisionUrl,
      apiKey: env.BLOCKVISION_RPC_API_KEY?.trim() || "",
    };
  }

  return null;
}

function rpcHeaders(config) {
  const h = { "content-type": "application/json" };
  if (config.provider === "shinami" && config.apiKey) {
    h["X-Api-Key"] = config.apiKey;
  }
  return h;
}

async function pingRpc(config) {
  const res = await fetch(config.url, {
    method: "POST",
    headers: rpcHeaders(config),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sui_getLatestCheckpointSequenceNumber",
      params: [],
    }),
  });

  const raw = await res.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return {
      httpStatus: res.status,
      rpcOk: false,
      rpcError: {
        message: "RPC returned non-JSON body",
        bodyPreview: raw.slice(0, 200),
      },
    };
  }

  const seq = body.result;
  const ok = typeof seq === "string" || typeof seq === "number";
  return {
    httpStatus: res.status,
    rpcOk: ok,
    checkpointSequence: ok ? String(seq) : undefined,
    rpcError: body.error ?? (!ok ? body : undefined),
  };
}

const env = loadDotEnv(envPath);
const config = pickRpcConfig(env);
if (!config) {
  console.error(
    "Missing RPC URL in .env — set SUI_RPC_URL (Shinami) or BLOCKVISION_RPC_URL",
  );
  process.exit(1);
}

if (config.provider === "shinami" && !config.apiKey) {
  console.error("Shinami requires SUI_RPC_API_KEY (or SHINAMI_API_KEY) in .env");
  process.exit(1);
}

let host = config.url;
try {
  host = new URL(config.url).host;
} catch {
  // keep raw
}

let ping = await pingRpc(config);
let usedFallback = false;

if (
  !ping.rpcOk &&
  config.provider === "shinami" &&
  (env.SUI_NETWORK?.trim() || "testnet") === "testnet" &&
  env.SMOKE_RPC_FALLBACK !== "0"
) {
  const fallback = await pingRpc({ provider: "public", url: PUBLIC_TESTNET_RPC, apiKey: "" });
  if (fallback.rpcOk) {
    ping = fallback;
    usedFallback = true;
  }
}

const ok = ping.rpcOk === true;

console.log(
  JSON.stringify(
    {
      envFile: ".env (repo root, local only)",
      provider: usedFallback ? "public-testnet-fallback" : config.provider,
      configuredProvider: config.provider,
      networkEnv: env.SUI_NETWORK?.trim() || "(unset)",
      rpcHost: usedFallback ? new URL(PUBLIC_TESTNET_RPC).host : host,
      apiKeyConfigured: Boolean(config.apiKey),
      rpcFallback: usedFallback,
      httpStatus: ping.httpStatus,
      rpcOk: ok,
      checkpointSequence: ping.checkpointSequence,
      rpcError: ping.rpcError,
    },
    null,
    2,
  ),
);

process.exit(ok ? 0 : 1);
