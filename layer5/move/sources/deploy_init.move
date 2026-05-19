/// One-shot mainnet/testnet bootstrap for Layer 5 shared infrastructure.
/// Call after publishing energy_settlement; requires energy_grid AdminCap.
module energy_settlement::deploy_init {
    use sui::event;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use energy_grid::energy_token::AdminCap;
    use energy_settlement::billing_operator;
    use energy_settlement::carbon_bridge;
    use energy_settlement::wormhole_core;
    use energy_settlement::grid_ledger;
    use energy_settlement::jurisdiction_policy;
    use energy_settlement::redemption_registry;
    use energy_settlement::usdc_settlement;
    use energy_settlement::version;

    public struct L5DeployManifest has copy, drop {
        package_version: u64,
        jurisdiction_policy_created: bool,
        redemption_registry_created: bool,
        grid_ledger_created: bool,
        carbon_whitelist_created: bool,
        wormhole_state_created: bool,
        price_feed_created: bool,
        deployer: address,
    }

    /// Initializes all L5 shared objects. Operator caps go to `tx_context::sender`.
    public entry fun initialize_l5_infrastructure(
        admin: &AdminCap,
        zone_id: u16,
        initial_price: u64,
        ctx: &mut TxContext,
    ) {
        let deployer = tx_context::sender(ctx);
        let _ = version::version();

        let policy = jurisdiction_policy::create(ctx);
        jurisdiction_policy::share(policy);

        redemption_registry::share_registry(redemption_registry::create_registry(ctx));

        grid_ledger::share_ledger(grid_ledger::create_ledger(zone_id, ctx));

        carbon_bridge::share_whitelist(carbon_bridge::create_whitelist(ctx));
        wormhole_core::share_wormhole_state(wormhole_core::init_wormhole_state(1_000_000, ctx));

        let feed = usdc_settlement::create_price_feed(initial_price, 0, 100, ctx);
        usdc_settlement::share_price_feed(feed);

        let billing_cap = billing_operator::create(admin, ctx);
        let grid_cap = grid_ledger::create_cap(ctx);
        transfer::public_transfer(billing_cap, deployer);
        transfer::public_transfer(grid_cap, deployer);

        event::emit(L5DeployManifest {
            package_version: version::version(),
            jurisdiction_policy_created: true,
            redemption_registry_created: true,
            grid_ledger_created: true,
            carbon_whitelist_created: true,
            wormhole_state_created: true,
            price_feed_created: true,
            deployer,
        });
    }
}
