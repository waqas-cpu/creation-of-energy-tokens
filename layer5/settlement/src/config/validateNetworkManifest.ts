import type { NetworkManifest, SuiNetwork } from "./loadNetworkManifest.js";

/** Sui object / package ID: 0x + 64 hex digits. */
export const SUI_OBJECT_ID_RE = /^0x[0-9a-fA-F]{64}$/;

const ZERO_ID = "0x0000000000000000000000000000000000000000000000000000000000000000";

export function isValidSuiObjectId(id: string): boolean {
  return SUI_OBJECT_ID_RE.test(id);
}

export function isPlaceholderObjectId(id: string): boolean {
  return id === ZERO_ID || !isValidSuiObjectId(id);
}

const EXTERNAL_CONTRACT_KEYS = [
  "nativeUsdcPackage",
  "wormholePackage",
  "wormholeStateObject",
  "pythPackage",
  "pythStateObject",
] as const;

/** Returns human-readable validation errors (empty = OK for external deps). */
export function validateExternalContracts(manifest: NetworkManifest): string[] {
  const errors: string[] = [];
  for (const key of EXTERNAL_CONTRACT_KEYS) {
    const id = manifest.contracts[key];
    if (isPlaceholderObjectId(id)) {
      errors.push(`${manifest.network}: contracts.${key} is missing or placeholder (${id})`);
    }
  }
  if (manifest.network === "testnet" && manifest.apis.pythHermes.includes("hermes.pyth.network")) {
    errors.push(
      "testnet: apis.pythHermes should use https://hermes-beta.pyth.network (mainnet Hermes on testnet will fail)",
    );
  }
  return errors;
}

export interface ProductionEnvRequirement {
  readonly name: string;
  readonly required: boolean;
}

export const MAINNET_ENV_REQUIREMENTS: readonly ProductionEnvRequirement[] = [
  { name: "L5_PACKAGE_ID", required: true },
  { name: "L3_GRID_PACKAGE_ID", required: true },
  { name: "L5_TREASURY_GUARD_ID", required: true },
  { name: "L5_REDEMPTION_REGISTRY_ID", required: true },
  { name: "PYTH_PRICE_FEED_ID", required: true },
  { name: "SUI_MULTISIG_PUBLIC_KEY", required: true },
];

export function validateProductionEnv(
  network: SuiNetwork,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  if (network !== "mainnet") return [];
  const errors: string[] = [];
  for (const { name, required } of MAINNET_ENV_REQUIREMENTS) {
    const v = env[name]?.trim();
    if (required && (!v || v === "0x..." || v.startsWith("0x..."))) {
      errors.push(`mainnet env: ${name} is unset or placeholder`);
    }
  }
  if (env.SUI_SIGNER_SECRET_KEY && !env.SUI_MULTISIG_PUBLIC_KEY) {
    errors.push("mainnet env: use multisig (SUI_MULTISIG_PUBLIC_KEY), not solo hot key only");
  }
  return errors;
}

export interface ProductionReadinessReport {
  readonly network: SuiNetwork;
  readonly manifestErrors: readonly string[];
  readonly envErrors: readonly string[];
  readonly ready: boolean;
}

export function assessProductionReadiness(
  network: SuiNetwork,
  manifest: NetworkManifest,
  env: NodeJS.ProcessEnv = process.env,
): ProductionReadinessReport {
  const manifestErrors = validateExternalContracts(manifest);
  const envErrors = validateProductionEnv(network, env);
  const envOkForMainnet = network !== "mainnet" || envErrors.length === 0;
  return {
    network,
    manifestErrors,
    envErrors,
    ready: manifestErrors.length === 0 && envOkForMainnet,
  };
}
