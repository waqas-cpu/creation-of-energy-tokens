export interface Layer3PublishedDeployment {
  readonly gridPackageId: string;
  readonly treasuryGuardId: string;
  readonly complianceRegistryId: string;
  readonly energyMeterId: string;
  readonly network: "mainnet" | "testnet" | "localnet";
  readonly rpcUrl: string;
}

function env(key: string): string | undefined {
  const v = process.env[key];
  return v?.length ? v : undefined;
}

export function hasLayer3Deployment(): boolean {
  return Boolean(env("L3_GRID_PACKAGE_ID") && env("L3_TREASURY_GUARD_ID"));
}

export function loadLayer3Deployment(): Layer3PublishedDeployment {
  const network = (env("SUI_NETWORK") ?? "testnet") as Layer3PublishedDeployment["network"];
  const rpc =
    env("SUI_RPC_URL") ??
    (network === "mainnet"
      ? "https://fullnode.mainnet.sui.io:443"
      : network === "localnet"
        ? "http://127.0.0.1:9000"
        : "https://fullnode.testnet.sui.io:443");
  const req = (k: string) => {
    const v = env(k);
    if (!v) throw new Error(`Missing env ${k}`);
    return v;
  };
  return {
    network,
    rpcUrl: rpc,
    gridPackageId: req("L3_GRID_PACKAGE_ID"),
    treasuryGuardId: req("L3_TREASURY_GUARD_ID"),
    complianceRegistryId: req("L3_COMPLIANCE_REGISTRY_ID"),
    energyMeterId: req("L3_ENERGY_METER_ID"),
  };
}
