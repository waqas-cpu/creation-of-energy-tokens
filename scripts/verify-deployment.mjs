#!/usr/bin/env node
/**
 * Verifies published object IDs exist on Sui RPC (mainnet/testnet pre-flight).
 * Usage: SUI_NETWORK=mainnet node scripts/verify-deployment.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const network = process.env.SUI_NETWORK ?? "testnet";
const manifest = JSON.parse(
  readFileSync(join(root, "config", "networks", `${network}.json`), "utf8"),
);
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

const ids = [
  ["L5_PACKAGE_ID", process.env.L5_PACKAGE_ID],
  ["L3_GRID_PACKAGE_ID", process.env.L3_GRID_PACKAGE_ID],
  ["L5_TREASURY_GUARD_ID", process.env.L5_TREASURY_GUARD_ID],
  ["L5_REDEMPTION_REGISTRY_ID", process.env.L5_REDEMPTION_REGISTRY_ID],
].filter(([, v]) => v);

if (ids.length === 0) {
  console.error("Set L5_PACKAGE_ID, L3_GRID_PACKAGE_ID, and object env vars first.");
  process.exit(1);
}

let failed = 0;
for (const [name, id] of ids) {
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
  console.log(`${ok ? "OK" : "MISSING"} ${name} ${id}`);
  if (!ok) failed++;
}
process.exit(failed > 0 ? 1 : 0);
