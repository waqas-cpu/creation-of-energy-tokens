#!/usr/bin/env node
/**
 * Clear pass/fail report: local .env + unit smoke + optional live API + RPC.
 * Does not print secret values.
 */
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const settlementDir = join(root, "layer5", "settlement");

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

loadDotEnv(join(root, ".env"));

const results = [];

function row(name, pass, detail, optional = false) {
  results.push({ name, pass, detail, optional });
  const tag = pass ? "PASS" : optional ? "SKIP" : "FAIL";
  console.log(`  [${tag}] ${name}${detail ? ` — ${detail}` : ""}`);
}

console.log("\n=== Settlement backend smoke test ===\n");

// 1 — .env
console.log("1. Local environment");
if (existsSync(join(root, ".env"))) {
  row(".env file present", true, "repo root");
} else {
  row(".env file present", false, "copy .env.example → .env");
}

const gitIgnore = existsSync(join(root, ".gitignore"))
  ? readFileSync(join(root, ".gitignore"), "utf8").includes(".env")
  : false;
row(".env in .gitignore", gitIgnore, gitIgnore ? "not committed" : "add .env to .gitignore");

const envCheck = spawnSync(process.execPath, [join(root, "scripts", "check-env-local.mjs")], {
  cwd: root,
  encoding: "utf8",
  env: process.env,
});
const envOk = envCheck.status === 0;
row("check-env-local.mjs", envOk, envOk ? "ok" : "see issues above");
if (!envOk && envCheck.stdout) {
  try {
    const envReport = JSON.parse(envCheck.stdout);
    for (const issue of envReport.issues ?? []) {
      console.log(`       · ${issue}`);
    }
    for (const warn of envReport.warnings ?? []) {
      console.log(`       · (warn) ${warn}`);
    }
  } catch {
    // ignore parse errors
  }
}

// 2 — Vitest backend smoke
console.log("\n2. Automated backend tests (vitest)");
const vitestBin = join(settlementDir, "node_modules", "vitest", "vitest.mjs");
if (!existsSync(vitestBin)) {
  row("backendSmoke.test.ts", false, "run: cd layer5/settlement && npm install");
} else {
  const vitestEnv = { ...process.env, IPFS_PROVIDER: "none", GATE_CHECK_RPC: "false" };
  delete vitestEnv.SETTLEMENT_API_PORT;
  const vitest = spawnSync(
    process.execPath,
    [vitestBin, "run", "tests/backendSmoke.test.ts"],
    { cwd: settlementDir, encoding: "utf8", env: vitestEnv },
  );
  row("backendSmoke.test.ts", vitest.status === 0, vitest.status === 0 ? "all tests passed" : "failed");
  if (vitest.status !== 0 && vitest.stdout) {
    const tail = vitest.stdout.split("\n").slice(-12).join("\n");
    console.log(tail);
  }
}

// 3 — RPC (optional)
console.log("\n3. Sui RPC (from .env)");
if (process.env.SUI_RPC_URL || process.env.BLOCKVISION_RPC_URL) {
  const rpc = spawnSync(process.execPath, [join(root, "scripts", "check-shinami-rpc.mjs")], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  let rpcOk = false;
  try {
    const j = JSON.parse(rpc.stdout || "{}");
    rpcOk = j.rpcOk === true;
    row("RPC ping", rpcOk, rpcOk ? `checkpoint ${j.checkpointSequence}` : j.rpcError?.message ?? "rpcOk false");
    if (j.provider === "shinami" && process.env.SUI_RPC_API_KEY && !process.env.SUI_RPC_API_KEY.startsWith("us1_sui_")) {
      row("Shinami key format", false, "use us1_sui_testnet_... with Shinami URL");
    } else if (j.provider === "shinami") {
      row("Shinami key format", true, "prefix ok");
    }
  } catch {
    row("RPC ping", false, "could not parse RPC check output");
  }
} else {
  row("RPC ping", false, "no SUI_RPC_URL or BLOCKVISION_RPC_URL");
}

// 4 — Live API on SETTLEMENT_API_PORT if already running (optional)
console.log("\n4. Live API (optional — start manually for integration)");
const port = process.env.SETTLEMENT_API_PORT ?? "3750";
const apiKey = process.env.SETTLEMENT_API_KEY?.trim();
try {
  const health = await fetch(`http://127.0.0.1:${port}/health`);
  row(
    `GET :${port}/health`,
    health.ok,
    health.ok ? await health.text() : `status ${health.status}`,
  );
  if (apiKey) {
    const gates = await fetch(`http://127.0.0.1:${port}/v1/gates`, {
      headers: { "X-Settlement-Api-Key": apiKey },
    });
    const g = await gates.json();
    row(
      `GET :${port}/v1/gates`,
      gates.status === 200 || gates.status === 503,
      `ready=${g.ready}`,
    );
  } else {
    row("GET /v1/gates (auth)", false, "SETTLEMENT_API_KEY not set", true);
  }
} catch {
  row(
    `GET :${port}/health`,
    false,
    "not running — start: cd layer5/settlement && npm run start:api",
    true,
  );
}

// 5 — Build
console.log("\n5. TypeScript build");
const tsc = spawnSync(process.execPath, [join(settlementDir, "node_modules", "typescript", "bin", "tsc")], {
  cwd: settlementDir,
  encoding: "utf8",
});
row("tsc compile", tsc.status === 0, tsc.status === 0 ? "dist/ up to date" : "compile errors");

const required = results.filter((r) => !r.optional);
const passed = required.filter((r) => r.pass).length;
const failed = required.filter((r) => !r.pass).length;
const skipped = results.filter((r) => r.optional && !r.pass).length;
console.log(
  `\n--- Summary: ${passed} passed, ${failed} failed${skipped ? `, ${skipped} optional skipped` : ""} ---\n`,
);

const critical = required.filter(
  (r) => !r.pass && (r.name.includes("backendSmoke") || r.name.includes("tsc")),
);
process.exit(failed === 0 ? 0 : critical.length > 0 ? 1 : 0);
