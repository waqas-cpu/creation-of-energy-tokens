import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONTRACTS_OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../contracts/out",
);

export interface ForgeArtifact {
  readonly abi: readonly Record<string, unknown>[];
  readonly bytecode: { readonly object: string };
}

export function loadArtifact(relativePath: string): ForgeArtifact {
  const file = join(CONTRACTS_OUT, relativePath);
  if (!existsSync(file)) {
    throw new Error(
      `Missing artifact ${file}. Run: cd layer4/contracts && forge build`,
    );
  }
  return JSON.parse(readFileSync(file, "utf8")) as ForgeArtifact;
}
