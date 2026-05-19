#!/usr/bin/env node
/**
 * Start settlement API + Vite dashboard (frontend proxies /settlement-api → :3750).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const settlementDir = join(root, "layer5", "settlement");

function runNode(name, cwd, script, extraEnv = {}) {
  const child = spawn(process.execPath, [script], {
    cwd,
    stdio: "inherit",
    env: { ...process.env, IPFS_PROVIDER: process.env.IPFS_PROVIDER ?? "none", ...extraEnv },
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

console.log("\nStarting settlement API (3750) + dashboard (5173)…\n");
console.log("  Dashboard: http://127.0.0.1:5173");
console.log("  API proxy: /settlement-api → http://127.0.0.1:3750\n");

const api = runSettlementApi();
const ui = runNode("frontend", root, join(root, "scripts", "run-vite-http.mjs"));

function shutdown() {
  api.kill();
  ui.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
