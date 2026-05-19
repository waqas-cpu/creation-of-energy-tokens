import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Load repo-root `.env` into `process.env` (does not override existing vars). */
export function loadRepoRootDotEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const path = join(dir, ".env");
    if (existsSync(path)) {
      applyDotEnvFile(path);
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

function applyDotEnvFile(path: string): void {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let v = t.slice(eq + 1).trim().replace(/^\uFEFF/, "");
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[key] = v;
  }
}
