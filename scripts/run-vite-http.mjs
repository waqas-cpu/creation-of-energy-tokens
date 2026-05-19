#!/usr/bin/env node
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const frontend = join(root, "frontend");
const viteBin = join(frontend, "node_modules", "vite", "bin", "vite.js");

const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1"], {
  cwd: frontend,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
