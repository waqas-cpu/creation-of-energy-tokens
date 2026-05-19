#!/usr/bin/env node
/**
 * Verify frontend + backend over HTTPS (Vite proxy → settlement API).
 * Run while `npm run dev:https:stack` is up, or pass --wait to poll until ready.
 *
 * Usage:
 *   npm run dev:https:stack
 *   npm run verify:https
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.HTTPS_STACK_URL?.trim() || "https://127.0.0.1:5173";
const API = `${BASE.replace(/\/$/, "")}/settlement-api`;
const wait = process.argv.includes("--wait");

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

async function fetchDev(url, opts = {}) {
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    return await fetch(url, opts);
  } finally {
    if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
  }
}

function row(name, pass, detail) {
  const tag = pass ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${name}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function probe() {
  const apiKey = loadApiKey();
  const headers = apiKey ? { "X-Settlement-Api-Key": apiKey } : {};

  const ui = await fetchDev(BASE);
  const uiOk = ui.ok && (await ui.text()).includes("root");

  const health = await fetchDev(`${API}/health`, { headers });
  let healthOk = false;
  let healthBody = "";
  if (health.ok) {
    healthBody = await health.text();
    try {
      healthOk = JSON.parse(healthBody).ok === true;
    } catch {
      healthOk = false;
    }
  }

  const gates = await fetchDev(`${API}/v1/gates`, { headers });
  let gatesOk = false;
  let gatesReady = "?";
  if (gates.ok || gates.status === 503) {
    gatesOk = true;
    try {
      const g = await gates.json();
      gatesReady = String(g.ready);
    } catch {
      gatesOk = false;
    }
  }

  return { uiOk, healthOk, healthBody, gatesOk, gatesReady };
}

console.log(`\n=== HTTPS stack verification ===\n  Base: ${BASE}\n`);

let result;
const deadline = Date.now() + (wait ? 90_000 : 0);
do {
  try {
    result = await probe();
    if (result.uiOk && result.healthOk) break;
  } catch (e) {
    result = null;
    if (!wait) {
      console.error(`  Cannot reach ${BASE} — start: npm run dev:https:stack\n`);
      console.error(`  ${e instanceof Error ? e.message : e}\n`);
      process.exit(1);
    }
  }
  if (wait && Date.now() < deadline) await sleep(2000);
} while (wait && Date.now() < deadline);

if (!result) {
  console.error("  Timed out waiting for HTTPS stack.\n");
  process.exit(1);
}

const r1 = row("Frontend (HTTPS)", result.uiOk, result.uiOk ? BASE : "no HTML");
const r2 = row(
  "Backend health (via proxy)",
  result.healthOk,
  result.healthOk ? result.healthBody.slice(0, 80) : `GET ${API}/health`,
);
const r3 = row("Backend gates (via proxy)", result.gatesOk, `ready=${result.gatesReady}`);

const all = r1 && r2 && r3;
console.log(`\n--- ${all ? "All checks passed" : "Some checks failed"} ---`);
console.log(`\nOpen dashboard: ${BASE}`);
console.log(`Status page:  ${BASE}/status`);
console.log(`Health JSON:  ${API}/health\n`);
process.exit(all ? 0 : 1);
