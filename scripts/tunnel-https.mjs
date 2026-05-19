#!/usr/bin/env node
/**
 * Public HTTPS URL via Cloudflare Quick Tunnel (requires cloudflared on PATH).
 * Tunnels to the local Vite HTTPS dashboard (API included via /settlement-api proxy).
 *
 * 1. npm run dev:https:stack
 * 2. npm run tunnel:https
 */
import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";

const LOCAL = process.env.HTTPS_STACK_URL?.trim() || "https://127.0.0.1:5173";

const hasCloudflared =
  spawnSync("cloudflared", ["--version"], { encoding: "utf8" }).status === 0;

if (!hasCloudflared) {
  console.error(`
cloudflared not found. Install for a public HTTPS link:
  Windows: winget install Cloudflare.cloudflared
  Or: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

Local HTTPS only (no install):
  npm run dev:https:stack
  Open ${LOCAL}
`);
  process.exit(1);
}

console.log(`\nTunneling ${LOCAL} → public HTTPS (cloudflared)…\n`);
console.log("Ensure npm run dev:https:stack is running in another terminal.\n");

const child = spawn("cloudflared", ["tunnel", "--url", LOCAL], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill());
