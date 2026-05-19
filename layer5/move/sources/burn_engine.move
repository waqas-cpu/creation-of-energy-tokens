/// Module 5.3 — Burn Engine (RULE-5.3-A..E).
module energy_settlement::burn_engine {
    use sui::coin::{Self, Coin};
    use sui::tx_context::TxContext;

    use energy_grid::energy_token::{Self, ENERGY};
    use energy_grid::treasury_guard::{Self, TreasuryGuard};
    use energy_settlement::bridge_adapter;
    use energy_settlement::credit_validation;
    use energy_settlement::l5_errors;

    public fun burn_energy(
        guard: &mut TreasuryGuard,
        coin: Coin<ENERGY>,
        kwh: u64,
        redemption_id: vector<u8>,
        consumer: address,
        ctx: &mut TxContext,
    ) {
        let required = credit_validation::checked_mul_kwh_scale(kwh);
        assert!(coin::value(&coin) == required, l5_errors::insufficient_balance());
        coin::burn(treasury_guard::borrow_treasury_for_burn(guard), coin);
        bridge_adapter::emit_burn_event(required, redemption_id, consumer, ctx);
    }
}
