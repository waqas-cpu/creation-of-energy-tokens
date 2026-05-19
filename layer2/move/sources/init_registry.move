/// One-time publish: shared Layer 2 objects for testnet / localnet.
module energy_oracle::init_registry {
    use sui::tx_context::{Self, TxContext};

    use energy_oracle::aggregator;
    use energy_oracle::compliance_bridge;
    use energy_oracle::device_registry;

    public struct DeployCap has key, store {
        id: sui::object::UID,
    }

    fun init(ctx: &mut TxContext) {
        let registry = device_registry::create_registry(ctx);
        let processed = energy_oracle::attestation::create_processed_table(ctx);
        let agg = aggregator::create_aggregator(
            vector[@0x1, @0x2, @0x3, @0x4, @0x5],
            ctx,
        );
        let spent = aggregator::create_spent_proofs(ctx);
        let compliance = compliance_bridge::create_registry(vector[], ctx);
        let blacklist = compliance_bridge::create_blacklist(ctx);
        let pyth_reg = energy_oracle::pyth_validation::create_registry(ctx);
        let zk = energy_oracle::zk_attestation::create_registry(b"vk_mainnet_v1", b"noir_energy_v1", ctx);

        device_registry::share_registry(registry);
        energy_oracle::attestation::share_processed_table(processed);
        aggregator::share_aggregator(agg);
        aggregator::share_spent_proofs(spent);
        compliance_bridge::share_registry(compliance);
        compliance_bridge::share_blacklist(blacklist);
        energy_oracle::pyth_validation::share_registry(pyth_reg);

        energy_oracle::zk_attestation::share_registry(zk);

        let cap = DeployCap { id: sui::object::new(ctx) };
        sui::transfer::transfer(cap, tx_context::sender(ctx));
    }
}
