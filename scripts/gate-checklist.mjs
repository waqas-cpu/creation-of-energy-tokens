#!/usr/bin/env node
/**
 * Full Layer 5 testnet gate checklist (loads repo-root .env like check-shinami-rpc.mjs).
 * Usage: node scripts/gate-checklist.mjs [--rpc]
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[key] = v;
  }
}

loadDotEnv(envPath);
if (process.argv.includes("--rpc")) {
  process.env.GATE_CHECK_RPC = "true";
}

const settlementDir = join(root, "layer5", "settlement");
const runner = join(settlementDir, "dist", "runGateChecklist.js");

let result;
if (existsSync(runner)) {
  result = spawnSync(process.execPath, [runner], {
    cwd: settlementDir,
    env: process.env,
    encoding: "utf8",
  });
} else {
  console.error("Build settlement first: cd layer5/settlement && npm run build");
  process.exit(1);
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
