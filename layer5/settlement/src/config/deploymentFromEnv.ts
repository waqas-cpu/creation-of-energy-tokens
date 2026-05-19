import {
  hasPublishedDeployment,
  loadPublishedDeployment,
} from "../publishedIds.js";
import type { SuiPtbConfig } from "../suiPtbClient.js";

export function suiPtbConfigFromEnv(): SuiPtbConfig {
  const network = (process.env.SUI_NETWORK ?? "testnet") as SuiPtbConfig["network"];

  if (hasPublishedDeployment()) {
    const dep = loadPublishedDeployment();
    return {
      packageId: dep.targets.l5PackageId,
      l3GridPackageId: dep.targets.l3GridPackageId,
      network: dep.network,
      rpcUrl: dep.rpcUrl,
      objects: dep.objects,
      signerSecretKey: process.env.SUI_SIGNER_SECRET_KEY,
      stub: false,
    };
  }

  const packageId = process.env.L5_PACKAGE_ID ?? "0x0";
  return {
    packageId,
    l3GridPackageId: process.env.L3_GRID_PACKAGE_ID,
    network,
    signerSecretKey: process.env.SUI_SIGNER_SECRET_KEY,
    stub: process.env.SUI_PTB_STUB !== "false",
  };
}
