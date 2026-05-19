import {
  bindHandoff,
  computeObligationHash,
  defaultDisputeDeadline,
  type ContractId,
  type ExecutionRequest,
  type LifecycleState,
  type Obligation,
  type ZKProof,
} from "@sui-energy/layer4-engine";

export type L3FsmState =
  | "DRAFT"
  | "MONITORING"
  | "TRIGGERED"
  | "DISPUTING"
  | "ARBITRATION_RESOLVED"
  | "SETTLEMENT_PENDING"
  | "SETTLED";

/**
 * EVM L3 Contract Engine stub — emits ExecutionRequest when TRIGGERED (vertical decomp L3→L4).
 */
export class L3ContractEngine {
  private state: L3FsmState = "MONITORING";

  getState(): L3FsmState {
    return this.state;
  }

  trigger(): void {
    if (this.state !== "MONITORING" && this.state !== "ARBITRATION_RESOLVED") {
      throw new Error("L3: invalid transition to TRIGGERED");
    }
    this.state = "TRIGGERED";
  }

  resolveArbitration(met: boolean): void {
    if (!met) {
      this.state = "DISPUTING";
      return;
    }
    this.state = "ARBITRATION_RESOLVED";
  }

  buildExecutionRequest(params: {
    contractId: ContractId;
    obligations: readonly Obligation[];
    zkProof: ZKProof;
    oracleSnapshotHash: `0x${string}`;
    signatures: readonly `0x${string}`[];
    nowSec?: bigint;
    disputeDeadline?: bigint;
  }): ExecutionRequest {
    const state: LifecycleState =
      this.state === "ARBITRATION_RESOLVED" ? "ARBITRATION_RESOLVED" : "TRIGGERED";
    if (this.state !== "TRIGGERED" && this.state !== "ARBITRATION_RESOLVED") {
      throw new Error(`L3: cannot build request in state ${this.state}`);
    }

    const now = params.nowSec ?? BigInt(Math.floor(Date.now() / 1000));
    const disputeDeadline = params.disputeDeadline ?? defaultDisputeDeadline(now);
    return bindHandoff(
      params.contractId,
      params.obligations,
      params.zkProof,
      params.oracleSnapshotHash,
      state,
      disputeDeadline,
      params.signatures,
    );
  }

  onExecutionSuccess(): void {
    this.state = "SETTLED";
  }

  onExecutionFailure(suggested: "MONITORING" | "DISPUTING" | "ARBITRATION"): void {
    this.state = suggested === "MONITORING" ? "MONITORING" : "DISPUTING";
  }

  registerObligationHash(obligations: readonly Obligation[]): `0x${string}` {
    return computeObligationHash(obligations);
  }
}
