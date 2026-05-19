import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type SuiNetwork = "mainnet" | "testnet" | "localnet";

export interface NetworkManifest {
  readonly network: SuiNetwork;
  readonly rpcUrl: string;
  readonly contracts: {
    readonly nativeUsdcPackage: string;
    readonly nativeUsdcType: string;
    readonly wormholePackage: string;
    readonly wormholeStateObject: string;
    readonly pythPackage: string;
    readonly pythStateObject: string;
  };
  readonly apis: {
    readonly wormholeScan: string;
    readonly pythHermes: string;
    readonly circleApi: string;
  };
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

export function loadNetworkManifest(network?: string): NetworkManifest {
  const net = (network ?? process.env.SUI_NETWORK ?? "testnet") as SuiNetwork;
  const file =
    net === "mainnet"
      ? "mainnet.json"
      : net === "localnet"
        ? "testnet.json"
        : "testnet.json";
  const path = join(repoRoot, "config", "networks", file);
  return JSON.parse(readFileSync(path, "utf8")) as NetworkManifest;
}
