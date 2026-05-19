#!/usr/bin/env node
/**
 * Pre-flight for native USDC + Pyth + Wormhole integration (mainnet/testnet).
 *
 * Usage:
 *   node scripts/verify-production-readiness.mjs
 *   SUI_NETWORK=mainnet node scripts/verify-production-readiness.mjs --rpc
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const network = process.env.SUI_NETWORK ?? "testnet";
const withRpc = process.argv.includes("--rpc");

const SUI_OBJECT_ID_RE = /^0x[0-9a-fA-F]{64}$/;
const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";

function loadManifest(net) {
  return JSON.parse(
    readFileSync(join(root, "config", "networks", `${net}.json`), "utf8"),
  );
}

function validateManifest(manifest) {
  const errors = [];
  const keys = [
    "nativeUsdcPackage",
    "wormholePackage",
    "wormholeStateObject",
    "pythPackage",
    "pythStateObject",
  ];
  for (const key of keys) {
    const id = manifest.contracts[key];
    if (!SUI_OBJECT_ID_RE.test(id) || id === ZERO) {
      errors.push(`${manifest.network}: contracts.${key} invalid (${id})`);
    }
  }
  if (
    manifest.network === "testnet" &&
    manifest.apis?.pythHermes === "https://hermes.pyth.network"
  ) {
    errors.push("testnet: use hermes-beta.pyth.network for Pyth Hermes");
  }
  return errors;
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
];

function validateTestnetEnv() {
  if (network !== "testnet") return [];
  const errors = [];
  for (const name of TESTNET_PUBLISH_KEYS) {
    const v = process.env[name]?.trim();
    if (!v || v.includes("...")) errors.push(`env ${name} unset`);
  }
  if (!process.env.SETTLEMENT_DATA_DIR?.trim()) {
    errors.push("env SETTLEMENT_DATA_DIR unset (required for testnet product backend)");
  }
  return errors;
}

function validateMainnetEnv() {
  if (network !== "mainnet") return [];
  const required = [
    "L5_PACKAGE_ID",
    "L3_GRID_PACKAGE_ID",
    "L5_TREASURY_GUARD_ID",
    "L5_REDEMPTION_REGISTRY_ID",
    "PYTH_PRICE_FEED_ID",
    "SUI_MULTISIG_PUBLIC_KEY",
  ];
  const errors = [];
  for (const name of required) {
    const v = process.env[name]?.trim();
    if (!v || v.includes("...")) errors.push(`env ${name} unset`);
  }
  return errors;
}

async function rpcCheckObject(rpc, label, id) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: rpcHeaders(),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sui_getObject",
      params: [id, { showType: true }],
    }),
  });
  const body = await res.json();
  const ok = body.result?.data != null;
  console.log(`  ${ok ? "OK" : "MISSING"} ${label}`);
  return ok;
}

const manifest = loadManifest(network);
const rpc =
  process.env.SUI_RPC_URL?.trim() ||
  process.env.SHINAMI_NODE_URL?.trim() ||
  process.env.SHINAMI_SUI_NODE_URL?.trim() ||
  manifest.rpcUrl;

function rpcHeaders() {
  const k =
    process.env.SUI_RPC_API_KEY?.trim() ||
    process.env.SHINAMI_API_KEY?.trim() ||
    process.env.SHINAMI_ACCESS_KEY?.trim();
  /** @type {Record<string, string>} */
  const h = { "content-type": "application/json" };
  if (k) h["X-Api-Key"] = k;
  return h;
}
const manifestErrors = validateManifest(manifest);
const envErrors =
  network === "testnet" ? validateTestnetEnv() : validateMainnetEnv();

console.log(`\n=== Production readiness (${network}) ===\n`);

console.log("Manifest (Circle USDC, Pyth, Wormhole):");
if (manifestErrors.length === 0) {
  console.log("  PASS — all external contract IDs are valid hex");
} else {
  for (const e of manifestErrors) console.log(`  FAIL — ${e}`);
}

console.log(`\nDeployed Layer 5 / Layer 3 (env, ${network}):`);
if (envErrors.length === 0) {
  console.log(`  PASS — required ${network} publish + backend env vars present`);
} else {
  for (const e of envErrors) console.log(`  FAIL — ${e}`);
  console.log(
    network === "mainnet"
      ? "  Hint: copy layer5/settlement/published-ids.mainnet.example.env"
      : "  Hint: copy layer5/settlement/published-ids.example.env + SETTLEMENT_DATA_DIR",
  );
}

let rpcHardFailures = 0;
if (withRpc) {
  console.log(`\nRPC object existence (${rpc}):`);
  for (const [label, id] of [
    ["wormholePackage", manifest.contracts.wormholePackage],
    ["wormholeState", manifest.contracts.wormholeStateObject],
    ["pythPackage", manifest.contracts.pythPackage],
    ["pythState", manifest.contracts.pythStateObject],
  ]) {
    if (!(await rpcCheckObject(rpc, label, id))) rpcHardFailures++;
  }
  const usdcLabel =
    network === "testnet"
      ? "nativeUsdcPackage (optional — confirm against Circle testnet docs)"
      : "nativeUsdcPackage";
  const usdcOk = await rpcCheckObject(rpc, usdcLabel, manifest.contracts.nativeUsdcPackage);
  if (!usdcOk && network === "mainnet") rpcHardFailures++;

  const l5 = process.env.L5_PACKAGE_ID;
  if (l5) {
    if (!(await rpcCheckObject(rpc, "L5_PACKAGE_ID", l5))) rpcHardFailures++;
  }
}

console.log("\nMove / TypeScript test gates (run locally):");
console.log("  layer5/move:     sui move test");
console.log("  layer5/settlement: npm run typecheck && npm test");

const blockers = [...manifestErrors, ...envErrors];
const integrationReady = manifestErrors.length === 0;
const mainnetTrafficReady =
  integrationReady && envErrors.length === 0 && network === "mainnet";

console.log("\n--- Summary ---");
console.log(
  integrationReady
    ? "  External integration (Pyth/Wormhole/USDC): READY for PTB wiring"
    : "  External integration: NOT READY — fix config/networks manifests",
);
console.log(
  mainnetTrafficReady
    ? "  Mainnet production traffic: READY (after your L5 publish + multisig ops)"
    : network === "mainnet"
      ? "  Mainnet production traffic: NOT READY — publish L5 and fill env"
      : "  Mainnet production traffic: run with SUI_NETWORK=mainnet after deploy",
);

process.exit(blockers.length > 0 || rpcHardFailures > 0 ? 1 : 0);
