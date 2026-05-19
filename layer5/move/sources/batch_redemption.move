/// Module 5.2 — Batch Redemption Tracker (RULE-5.2-A..E).
module energy_settlement::batch_redemption {
    use sui::object::ID;
    use sui::tx_context::TxContext;

    use energy_grid::batch_receipt;
    use energy_grid::energy_token::EnergyBatch;
    use energy_settlement::bridge_adapter;

    public fun mark_redeemed(
        batch: &mut EnergyBatch,
        redemption_id: vector<u8>,
        consumer: address,
        ctx: &mut TxContext,
    ) {
        let batch_id = sui::object::id(batch);
        let kwh = energy_grid::energy_token::batch_kwh(batch);
        batch_receipt::mark_redeemed(batch);
        bridge_adapter::emit_redemption_event(redemption_id, batch_id, kwh, consumer, ctx);
    }

    public fun is_redeemed(batch: &EnergyBatch): bool {
        batch_receipt::is_redeemed(batch)
    }
}
