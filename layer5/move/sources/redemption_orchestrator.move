/// Module 5.5 — Settlement Orchestrator (PTB composition, RULE-5.5-A..E).
module energy_settlement::redemption_orchestrator {
    use sui::coin::Coin;
    use sui::object;
    use sui::tx_context::TxContext;

    use energy_grid::compliance_registry::ComplianceRegistry;
    use energy_grid::energy_token::{Self, ENERGY, EnergyBatch, EnergyMeter};
    use energy_grid::treasury_guard::TreasuryGuard;
    use energy_settlement::billing_operator::BillingOperatorCap;
    use energy_settlement::grid_ledger::{Self, GridOperatorCap, GridSettlementLedger};
    use energy_settlement::jurisdiction_policy::JurisdictionPolicy;
    use energy_settlement::redemption_registry::RedemptionRegistry;
    use energy_settlement::utility_billing::{Self, BillingReceipt};

    public fun redeem_atomic(
        guard: &mut TreasuryGuard,
        batch: &mut EnergyBatch,
        coin: Coin<ENERGY>,
        meter: &EnergyMeter,
        compliance: &ComplianceRegistry,
        jurisdiction: &JurisdictionPolicy,
        redemption_reg: &mut RedemptionRegistry,
        operator_cap: &GridOperatorCap,
        billing_operator_cap: &BillingOperatorCap,
        ledger: &mut GridSettlementLedger,
        redemption_id: vector<u8>,
        kwh: u64,
        billing_period_end: u64,
        billing_period_override: bool,
        usdc_equiv: u64,
        ctx: &mut TxContext,
    ) {
        let burn_amount = kwh * energy_token::kwh_scale();
        let receipt = utility_billing::redeem_billing(
            guard,
            batch,
            coin,
            meter,
            compliance,
            jurisdiction,
            redemption_reg,
            redemption_id,
            kwh,
            billing_period_end,
            billing_period_override,
            billing_operator_cap,
            ctx,
        );
        let credit_note_id = object::id(&receipt);
        let consumer = sui::tx_context::sender(ctx);
        grid_ledger::record_settlement(
            operator_cap,
            ledger,
            consumer,
            kwh,
            burn_amount,
            credit_note_id,
            usdc_equiv,
            ctx,
        );
        utility_billing::transfer_receipt(receipt, consumer);
    }
}
