import { describe, expect, it } from "vitest";
import { loadNetworkManifest } from "../src/config/loadNetworkManifest.js";
import {
  assessProductionReadiness,
  isValidSuiObjectId,
  validateExternalContracts,
} from "../src/config/validateNetworkManifest.js";

describe("validateNetworkManifest", () => {
  it("accepts official mainnet external contract IDs", () => {
    const m = loadNetworkManifest("mainnet");
    expect(validateExternalContracts(m)).toEqual([]);
    expect(isValidSuiObjectId(m.contracts.wormholePackage)).toBe(true);
  });

  it("accepts official testnet external contract IDs", () => {
    const m = loadNetworkManifest("testnet");
    expect(validateExternalContracts(m)).toEqual([]);
    expect(m.apis.pythHermes).toContain("hermes-beta");
  });

  it("flags mainnet env when L5_PACKAGE_ID missing", () => {
    const m = loadNetworkManifest("mainnet");
    const report = assessProductionReadiness("mainnet", m, {});
    expect(report.manifestErrors).toEqual([]);
    expect(report.ready).toBe(false);
    expect(report.envErrors.length).toBeGreaterThan(0);
  });
});
