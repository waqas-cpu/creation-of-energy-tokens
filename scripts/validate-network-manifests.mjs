import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "config", "networks");

const SUI_OBJECT_ID_RE = /^0x[0-9a-fA-F]{64}$/;
const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const path = join(dir, file);
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (!data.network || !data.rpcUrl || !data.contracts?.nativeUsdcType) {
    throw new Error(`Invalid manifest: ${file}`);
  }
  for (const key of [
    "nativeUsdcPackage",
    "wormholePackage",
    "wormholeStateObject",
    "pythPackage",
    "pythStateObject",
  ]) {
    const id = data.contracts[key];
    if (typeof id !== "string" || !SUI_OBJECT_ID_RE.test(id) || id === ZERO) {
      throw new Error(`Invalid ${key} in ${file}: ${id}`);
    }
  }
  if (data.network === "testnet" && data.apis?.pythHermes === "https://hermes.pyth.network") {
    throw new Error(`${file}: testnet must use hermes-beta.pyth.network`);
  }
  console.log(`OK ${file} (${data.network})`);
}