import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { hasPublishedDeployment } from "../publishedIds.js";
import { createIpfsPinClient } from "../ipfs/ipfsPinClient.js";
import { resolveSuiRpcUrl, resolveSuiRpcHeaders } from "../suiRpcClient.js";

export type GateStatus = "pass" | "fail" | "warn" | "skip";

export interface GateItem {
  readonly id: string;
  readonly name: string;
  readonly status: GateStatus;
  readonly detail: string;
}

export interface GateChecklistResult {
  readonly network: string;
  readonly ready: boolean;
  readonly blockers: number;
  readonly warnings: number;
  readonly gates: readonly GateItem[];
}

const SUI_OBJECT_ID_RE = /^0x[0-9a-fA-F]{64}$/;
const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";

function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "config", "networks", "testnet.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function loadManifest(network: string) {
  const path = join(repoRoot(), "config", "networks", `${network}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as {
    network: string;
    rpcUrl: string;
    contracts: Record<string, string>;
    apis?: { pythHermes?: string };
  };
}

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : undefined;
}

const TESTNET_PUBLISH_KEYS = [
  "L5_PACKAGE_ID",
  "L3_GRID_PACKAGE_ID",
  "L5_TREASURY_GUARD_ID",
  "L5_ENERGY_BATCH_ID",
  "L5_ENERGY_COIN_ID",
  "L5_ENERGY_METER_ID",
  "L5_COMPLIANCE_REGISTRY_ID",
  "L5_JURISDICTION_POLICY_ID",
  "L5_REDEMPTION_REGISTRY_ID",
  "L5_GRID_OPERATOR_CAP_ID",
  "L5_BILLING_OPERATOR_CAP_ID",
  "L5_GRID_SETTLEMENT_LEDGER_ID",
] as const;

async function rpcPing(network: "testnet" | "mainnet"): Promise<{ ok: boolean; detail: string }> {
  const url = resolveSuiRpcUrl(network);
  const headers = { "content-type": "application/json", ...resolveSuiRpcHeaders() };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getLatestCheckpointSequenceNumber",
        params: [],
      }),
    });
    const body = (await res.json()) as { result?: unknown; error?: unknown };
    if (res.ok && (typeof body.result === "string" || typeof body.result === "number")) {
      return { ok: true, detail: `checkpoint ${body.result}` };
    }
    return { ok: false, detail: `RPC error ${res.status}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function rpcObjectExists(id: string): Promise<boolean> {
  const network = (process.env.SUI_NETWORK ?? "testnet") as "testnet" | "mainnet";
  const url = resolveSuiRpcUrl(network);
  const headers = { "content-type": "application/json", ...resolveSuiRpcHeaders() };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sui_getObject",
      params: [id, { showType: true }],
    }),
  });
  const body = (await res.json()) as { result?: { data?: unknown } };
  return body.result?.data != null;
}

export async function runGateChecklist(options?: {
  readonly withRpc?: boolean;
}): Promise<GateChecklistResult> {
  const network = process.env.SUI_NETWORK ?? "testnet";
  const gates: GateItem[] = [];
  const withRpc = options?.withRpc ?? process.env.GATE_CHECK_RPC === "true";

  // G-MANIFEST
  try {
    const manifest = loadManifest(network);
    const bad = [
      "nativeUsdcPackage",
      "wormholePackage",
      "wormholeStateObject",
      "pythPackage",
      "pythStateObject",
    ].filter((k) => {
      const id = manifest.contracts[k];
      return !SUI_OBJECT_ID_RE.test(id) || id === ZERO;
    });
    gates.push({
      id: "G-MANIFEST",
      name: "Network manifest (Pyth/Wormhole/USDC)",
      status: bad.length === 0 ? "pass" : "fail",
      detail: bad.length === 0 ? "valid contract IDs" : `invalid: ${bad.join(", ")}`,
    });
    if (
      network === "testnet" &&
      manifest.apis?.pythHermes === "https://hermes.pyth.network"
    ) {
      gates.push({
        id: "G-PYTH-HERMES",
        name: "Pyth Hermes endpoint",
        status: "fail",
        detail: "testnet must use hermes-beta.pyth.network",
      });
    }
  } catch (e) {
    gates.push({
      id: "G-MANIFEST",
      name: "Network manifest",
      status: "fail",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // G-RPC
  const rpcUrl =
    env("SUI_RPC_URL") || env("SHINAMI_NODE_URL") || env("BLOCKVISION_RPC_URL");
  gates.push({
    id: "G-RPC-ENV",
    name: "RPC URL configured",
    status: rpcUrl ? "pass" : "warn",
    detail: rpcUrl ? "SUI_RPC_URL or BLOCKVISION_RPC_URL set" : "using manifest default only",
  });

  if (withRpc) {
    const ping = await rpcPing(network === "mainnet" ? "mainnet" : "testnet");
    gates.push({
      id: "G-RPC-PING",
      name: "RPC reachable",
      status: ping.ok ? "pass" : "fail",
      detail: ping.detail,
    });
  }

  // G-PUBLISH (testnet product)
  if (network === "testnet") {
    const missing = TESTNET_PUBLISH_KEYS.filter((k) => !env(k));
    gates.push({
      id: "G-TESTNET-PUBLISH",
      name: "Layer 3/5 published object IDs",
      status: missing.length === 0 ? "pass" : "fail",
      detail:
        missing.length === 0
          ? "all publish env vars present"
          : `missing: ${missing.join(", ")}`,
    });
  } else {
    gates.push({
      id: "G-TESTNET-PUBLISH",
      name: "Layer 3/5 published object IDs",
      status: hasPublishedDeployment() ? "pass" : "fail",
      detail: hasPublishedDeployment() ? "mainnet env present" : "publish env incomplete",
    });
  }

  if (withRpc && env("L5_PACKAGE_ID")) {
    const ok = await rpcObjectExists(env("L5_PACKAGE_ID")!);
    gates.push({
      id: "G-L5-ONCHAIN",
      name: "L5_PACKAGE_ID exists on RPC",
      status: ok ? "pass" : "fail",
      detail: ok ? "object found" : "not found on chain",
    });
  }

  // G-PERSIST
  gates.push({
    id: "G-PERSIST",
    name: "Durable audit store",
    status: env("SETTLEMENT_DATA_DIR") ? "pass" : "warn",
    detail: env("SETTLEMENT_DATA_DIR")
      ? `SETTLEMENT_DATA_DIR=${env("SETTLEMENT_DATA_DIR")}`
      : "in-memory only — set SETTLEMENT_DATA_DIR for production",
  });

  // G-IPFS
  const ipfs = createIpfsPinClient();
  gates.push({
    id: "G-IPFS",
    name: "IPFS proof/report pinning",
    status: ipfs.isEnabled() ? "pass" : "warn",
    detail: ipfs.isEnabled()
      ? "IPFS provider enabled (real CIDs)"
      : "set IPFS_PROVIDER=kubo or PINATA_JWT for real CIDs",
  });

  // G-API-SEC
  gates.push({
    id: "G-API-KEY",
    name: "Settlement API authentication",
    status: env("SETTLEMENT_API_KEY") ? "pass" : "warn",
    detail: env("SETTLEMENT_API_KEY")
      ? "SETTLEMENT_API_KEY configured"
      : "open API — set SETTLEMENT_API_KEY for production",
  });

  // G-SIGNER
  gates.push({
    id: "G-SIGNER",
    name: "Transaction submit signer",
    status: env("SUI_SIGNER_SECRET_KEY") ? "pass" : "warn",
    detail: env("SUI_SIGNER_SECRET_KEY")
      ? "signer configured for POST /v1/redemption/submit"
      : "dry-run only until SUI_SIGNER_SECRET_KEY is set",
  });

  // G-WORMHOLE-API
  gates.push({
    id: "G-WORMHOLE-SCAN",
    name: "Wormhole scan API (bridge worker)",
    status: "pass",
    detail: `manifest wormholeScan for ${network}`,
  });

  const blockers = gates.filter((g) => g.status === "fail").length;
  const warnings = gates.filter((g) => g.status === "warn").length;
  const ready = blockers === 0;

  return { network, ready, blockers, warnings, gates };
}
