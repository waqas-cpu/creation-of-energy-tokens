import type { Layer5PackageTargets, Layer5RedeemObjects } from "./buildRedeemPtb.js";

/** Loaded from env after `sui client publish` on testnet/mainnet. */
export interface PublishedDeployment {
  readonly targets: Layer5PackageTargets;
  readonly objects: Layer5RedeemObjects;
  readonly network: "localnet" | "testnet" | "mainnet";
  readonly rpcUrl: string;
}

function env(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

function required(key: string): string {
  const v = env(key);
  if (!v) {
    throw new Error(`Missing env ${key} — publish Layer 3/5 and set object IDs (see published-ids.example.env)`);
  }
  return v;
}

const RPC_BY_NETWORK: Record<PublishedDeployment["network"], string> = {
  localnet: "http://127.0.0.1:9000",
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
};

export function isStubPackageId(packageId: string): boolean {
  const p = packageId.toLowerCase();
  return p === "0x0" || p === "0x00" || p === "0xpkg" || p === "";
}

/** True when all publish env vars are present for on-chain PTB. */
export function hasPublishedDeployment(): boolean {
  return Boolean(env("L5_PACKAGE_ID") && env("L3_GRID_PACKAGE_ID") && env("L5_TREASURY_GUARD_ID"));
}

export function loadPublishedDeployment(): PublishedDeployment {
  const network = (env("SUI_NETWORK") ?? "testnet") as PublishedDeployment["network"];
  return {
    network,
    rpcUrl:
      env("SUI_RPC_URL") ??
      env("SHINAMI_NODE_URL") ??
      env("SHINAMI_SUI_NODE_URL") ??
      env("BLOCKVISION_RPC_URL") ??
      RPC_BY_NETWORK[network],
    targets: {
      l5PackageId: required("L5_PACKAGE_ID"),
      l3GridPackageId: required("L3_GRID_PACKAGE_ID"),
    },
    objects: {
      treasuryGuardId: required("L5_TREASURY_GUARD_ID"),
      energyBatchId: required("L5_ENERGY_BATCH_ID"),
      energyCoinId: required("L5_ENERGY_COIN_ID"),
      energyMeterId: required("L5_ENERGY_METER_ID"),
      complianceRegistryId: required("L5_COMPLIANCE_REGISTRY_ID"),
      jurisdictionPolicyId: required("L5_JURISDICTION_POLICY_ID"),
      redemptionRegistryId: required("L5_REDEMPTION_REGISTRY_ID"),
      gridOperatorCapId: required("L5_GRID_OPERATOR_CAP_ID"),
      billingOperatorCapId: required("L5_BILLING_OPERATOR_CAP_ID"),
      gridSettlementLedgerId: required("L5_GRID_SETTLEMENT_LEDGER_ID"),
    },
  };
}

export function loadPublishedDeploymentOrStub(
  fallbackPackageId = "0x0",
): PublishedDeployment | null {
  if (!hasPublishedDeployment()) return null;
  try {
    return loadPublishedDeployment();
  } catch {
    return null;
  }
}
