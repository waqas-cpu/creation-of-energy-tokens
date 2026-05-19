#!/usr/bin/env node
/**
 * HTTPS dev stack: settlement API (:3750) + Vite dashboard (https://127.0.0.1:5173).
 * API is reached via same-origin proxy: /settlement-api → backend.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const settlementDir = join(root, "layer5", "settlement");
const HTTPS_URL = "https://127.0.0.1:5173";

function loadApiKey() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return "";
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("SETTLEMENT_API_KEY=")) continue;
    return t.slice("SETTLEMENT_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

function runNode(name, cwd, script, extraEnv = {}) {
  const child = spawn(process.execPath, [script], {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      IPFS_PROVIDER: process.env.IPFS_PROVIDER ?? "none",
      ...extraEnv,
    },
  });
  child.on("exit", (code) => {
    if (code && code !== 0) console.error(`[${name}] exited ${code}`);
  });
  return child;
}

function runSettlementApi() {
  const runApi = join(settlementDir, "dist", "runSettlementApi.js");
  if (!existsSync(runApi)) {
    console.error("Build settlement first: cd layer5/settlement && npm run build");
    process.exit(1);
  }
  return runNode("settlement-api", settlementDir, runApi);
}

const apiKey = loadApiKey();

console.log("\n=== HTTPS dev stack ===\n");
console.log(`  Dashboard (open in browser): ${HTTPS_URL}`);
console.log(`  API (via proxy):           ${HTTPS_URL}/settlement-api/health`);
console.log("  Backend (direct):          http://127.0.0.1:3750\n");
console.log(
  "  Browser may warn about the local certificate — choose Advanced → Continue (dev only).\n",
);
if (apiKey) {
  console.log("  Sidebar API key: use SETTLEMENT_API_KEY from repo-root .env\n");
}

const api = runSettlementApi();
const ui = runNode("frontend-https", root, join(root, "scripts", "run-vite-https.mjs"));

function shutdown() {
  api.kill();
  ui.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
