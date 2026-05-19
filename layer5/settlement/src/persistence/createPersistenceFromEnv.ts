import { AuditStore } from "../auditStore.js";
import { ZKProofArchive } from "../zkProofArchive.js";
import { RegulatoryReporter } from "../regulatoryReporter.js";
import { createIpfsPinClient } from "../ipfs/ipfsPinClient.js";
import { settlementDataDir } from "./dataDir.js";
import { DiskAuditStore } from "./diskAuditStore.js";
import { DiskRegulatoryReporter } from "./diskRegulatoryReporter.js";
import { DiskZkProofArchive } from "./diskZkProofArchive.js";
import { IpfsProofArchive } from "./ipfsProofArchive.js";
import { IpfsRegulatoryReporter } from "./ipfsRegulatoryReporter.js";
import type {
  SettlementArchive,
  SettlementAudit,
  SettlementReporter,
} from "./settlementPersistenceTypes.js";

export interface SettlementPersistence {
  readonly audit: SettlementAudit;
  readonly archive: SettlementArchive;
  readonly reporter: SettlementReporter;
}

export function createPersistenceFromEnv(): SettlementPersistence {
  const root = settlementDataDir();
  const ipfs = createIpfsPinClient();

  if (!root) {
    return {
      audit: new AuditStore(),
      archive: new ZKProofArchive(),
      reporter: new RegulatoryReporter(),
    };
  }

  const archive: SettlementArchive = ipfs.isEnabled()
    ? new IpfsProofArchive(root, ipfs)
    : new DiskZkProofArchive(root);
  const reporter: SettlementReporter = ipfs.isEnabled()
    ? new IpfsRegulatoryReporter(root, ipfs)
    : new DiskRegulatoryReporter(root);

  return {
    audit: new DiskAuditStore(root),
    archive,
    reporter,
  };
}
