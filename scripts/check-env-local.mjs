#!/usr/bin/env node
/**
 * Validates repo-root .env for local dev — never prints secret values.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

function parseEnv(path) {
  const vars = {};
  if (!existsSync(path)) return vars;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    vars[k] = v;
  }
  return vars;
}

function mask(v) {
  if (!v) return { set: false, length: 0 };
  const looksPlaceholder =
    v.includes("...") ||
    v === "change-me-local-dev-only" ||
    v === "your-" ||
    /^<.*>$/.test(v);
  return {
    set: v.length > 0,
    length: v.length,
    placeholder: looksPlaceholder,
  };
}

const SECRET_KEYS = new Set([
  "SUI_RPC_API_KEY",
  "SHINAMI_API_KEY",
  "SHINAMI_ACCESS_KEY",
  "BLOCKVISION_RPC_API_KEY",
  "SUI_SIGNER_SECRET_KEY",
  "SETTLEMENT_API_KEY",
  "PINATA_JWT",
  "IPFS_PINATA_JWT",
  "CIRCLE_API_KEY",
  "GRID_OPERATOR_API_KEY",
]);

const PUBLISH_KEYS = [
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

const env = parseEnv(envPath);
const network = env.SUI_NETWORK ?? "(unset)";

const report = {
  envFile: existsSync(envPath) ? ".env (repo root)" : "MISSING .env",
  gitignore: existsSync(join(root, ".gitignore"))
    ? readFileSync(join(root, ".gitignore"), "utf8").includes(".env")
    : false,
  network,
  rpc: {
    SUI_RPC_URL: mask(env.SUI_RPC_URL),
    BLOCKVISION_RPC_URL: mask(env.BLOCKVISION_RPC_URL),
    SUI_RPC_API_KEY: mask(env.SUI_RPC_API_KEY),
    BLOCKVISION_RPC_API_KEY: mask(env.BLOCKVISION_RPC_API_KEY),
  },
  backend: {
    SETTLEMENT_DATA_DIR: mask(env.SETTLEMENT_DATA_DIR),
    SETTLEMENT_API_KEY: mask(env.SETTLEMENT_API_KEY),
    SETTLEMENT_API_PUBLIC_READ: env.SETTLEMENT_API_PUBLIC_READ ?? "(unset)",
    SETTLEMENT_API_PORT: env.SETTLEMENT_API_PORT ?? "(unset)",
  },
  ipfs: {
    IPFS_PROVIDER: env.IPFS_PROVIDER ?? "(unset)",
    IPFS_KUBO_API_URL: env.IPFS_KUBO_API_URL ?? "(unset)",
    PINATA_JWT: mask(env.PINATA_JWT),
  },
  signer: mask(env.SUI_SIGNER_SECRET_KEY),
  publish: Object.fromEntries(
    PUBLISH_KEYS.map((k) => [k, mask(env[k])]),
  ),
  issues: [],
  ok: true,
};

if (!existsSync(envPath)) {
  report.issues.push("Create .env from .env.example");
  report.ok = false;
}

if (!report.gitignore) {
  report.issues.push("Add .env to repo-root .gitignore");
  report.ok = false;
}

const gitCheck = spawnSync("git", ["check-ignore", "-q", ".env"], { cwd: root, encoding: "utf8" });
if (gitCheck.status !== 0 && existsSync(join(root, ".git"))) {
  report.issues.push(".env is NOT ignored by git — run: git rm --cached .env if it was committed");
  report.ok = false;
} else if (!existsSync(join(root, ".git"))) {
  report.warnings = report.warnings ?? [];
  report.warnings.push("Not a git repo — .gitignore still recommended for when you init git");
}

if (network === "mainnet" && env.BLOCKVISION_RPC_URL?.includes("mainnet")) {
  report.issues.push(
    "SUI_NETWORK=mainnet + Blockvision mainnet — for testnet product use SUI_NETWORK=testnet",
  );
}

if (!env.SUI_RPC_URL && !env.BLOCKVISION_RPC_URL) {
  report.issues.push("Set SUI_RPC_URL or BLOCKVISION_RPC_URL");
  report.ok = false;
}

if (env.SUI_RPC_URL && !env.SUI_RPC_API_KEY && env.SUI_RPC_URL.includes("shinami.com")) {
  report.issues.push("Shinami URL set but SUI_RPC_API_KEY is empty");
}
if (
  env.SUI_RPC_URL?.includes("shinami.com") &&
  env.SUI_RPC_API_KEY &&
  !env.SUI_RPC_API_KEY.startsWith("us1_sui_")
) {
  report.warnings = report.warnings ?? [];
  report.warnings.push(
    "SUI_RPC_URL is Shinami but SUI_RPC_API_KEY does not look like a Shinami key (expected us1_sui_testnet_... or us1_sui_mainnet_...)",
  );
}
if (env.SUI_RPC_URL?.includes("quiknode.pro") && env.SUI_RPC_API_KEY?.trim()) {
  report.warnings = report.warnings ?? [];
  report.warnings.push(
    "QuickNode: auth is usually in SUI_RPC_URL path — leave SUI_RPC_API_KEY empty unless QuickNode gave a separate header key",
  );
}

if (env.BLOCKVISION_RPC_URL && env.BLOCKVISION_RPC_API_KEY) {
  const url = env.BLOCKVISION_RPC_URL;
  const key = env.BLOCKVISION_RPC_API_KEY;
  if (url.includes(key) && key.length > 8) {
    report.issues.push(
      "BLOCKVISION key appears embedded in BLOCKVISION_RPC_URL — prefer URL path only OR key only (avoid duplicating secret)",
    );
  }
}

if (!env.SETTLEMENT_DATA_DIR) {
  report.issues.push("SETTLEMENT_DATA_DIR unset — audit/proofs stay in-memory only");
}

if (!env.SETTLEMENT_API_KEY || mask(env.SETTLEMENT_API_KEY).placeholder) {
  report.issues.push("SETTLEMENT_API_KEY unset or placeholder — API write routes need a real local key");
}

const missingPublish = PUBLISH_KEYS.filter((k) => !env[k]?.trim());
if (missingPublish.length > 0 && missingPublish.length < PUBLISH_KEYS.length) {
  report.issues.push(`Partial publish env — missing ${missingPublish.length} of ${PUBLISH_KEYS.length} IDs`);
}
if (missingPublish.length === PUBLISH_KEYS.length) {
  report.issues.push("No L5/L3 publish IDs — on-chain submit will stay in stub mode");
}

for (const [k, m] of Object.entries(report.publish)) {
  if (m.set && m.placeholder) {
    report.issues.push(`${k} looks like a placeholder`);
  }
}

const layerEnv = join(root, "layer5", "settlement", ".env");
if (existsSync(layerEnv)) {
  report.issues.push(
    "layer5/settlement/.env exists — use repo-root .env only to avoid duplicate/conflicting secrets",
  );
}

if (report.warnings?.length) {
  console.error("Warnings:");
  for (const w of report.warnings) console.error(`  - ${w}`);
}
if (report.issues.length) {
  console.error("Issues:");
  for (const i of report.issues) console.error(`  - ${i}`);
}
console.log(JSON.stringify(report, null, 2));
const blockers = report.issues.filter(
  (i) =>
    !i.includes("stub mode") &&
    !i.includes("in-memory only") &&
    !i.includes("Partial publish") &&
    !i.includes("SETTLEMENT_API_KEY unset or placeholder") &&
    !i.includes("testnet product use"),
);
process.exit(report.ok && blockers.length === 0 ? 0 : blockers.length > 0 ? 1 : 0);
