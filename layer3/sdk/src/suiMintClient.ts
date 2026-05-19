import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { buildLayer3MintPtb } from "./buildMintPtb.js";
import { loadLayer3Deployment } from "./publishedIds.js";

export interface MintPlan {
  readonly kwhDelta: bigint;
  readonly readingTimestamp: bigint;
  readonly secp256k1Sig: Uint8Array;
  readonly source: number;
  readonly producerAddress: string;
}

export class SuiMintClient {
  private readonly client: SuiClient;
  private readonly deployment = loadLayer3Deployment();

  constructor() {
    const url =
      this.deployment.rpcUrl ??
      getFullnodeUrl(this.deployment.network === "mainnet" ? "mainnet" : "testnet");
    this.client = new SuiClient({ url });
  }

  buildMintTransaction(plan: MintPlan): Transaction {
    const tx = new Transaction();
    return buildLayer3MintPtb(
      tx,
      { gridPackageId: this.deployment.gridPackageId },
      {
        treasuryGuardId: this.deployment.treasuryGuardId,
        complianceRegistryId: this.deployment.complianceRegistryId,
        energyMeterId: this.deployment.energyMeterId,
      },
      {
        deviceId: [],
        kwhDelta: plan.kwhDelta,
        timestampMs: plan.readingTimestamp,
        secp256k1Sig: [...plan.secp256k1Sig],
      },
      plan.readingTimestamp,
      plan.source,
      plan.producerAddress,
    );
  }

  async dryRun(plan: MintPlan, sender: string) {
    const tx = this.buildMintTransaction(plan);
    return this.client.devInspectTransactionBlock({ transactionBlock: tx, sender });
  }
}
