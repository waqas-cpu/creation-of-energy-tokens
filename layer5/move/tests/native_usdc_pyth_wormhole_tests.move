#[test_only]
module energy_settlement::native_usdc_pyth_wormhole_tests {
    use sui::clock::{Self, Clock};
    use sui::coin;
    use sui::test_scenario::{Self as ts};
    use sui::transfer;

    use energy_grid::compliance_registry::{Self, ComplianceRegistry};
    use energy_grid::energy_token::{Self, AdminCap, ENERGY, EnergyMeter};
    use energy_grid::meter_registry;
    use energy_grid::minting_engine;
    use energy_grid::treasury_guard::{Self, TreasuryGuard};

    use energy_settlement::carbon_bridge;
    use energy_settlement::native_usdc_settlement;
    use energy_settlement::oracle_attestation;
    use energy_settlement::pyth_price_sync;
    use energy_settlement::usdc_settlement;
    use energy_settlement::wormhole_core;
    use usdc::usdc::USDC;
    use wormhole::emitter::EmitterCap;
    use wormhole::state::State as WormholeCoreState;

    const ADMIN: address = @0xAD;
    const PRODUCER: address = @0xB0;
    const BUYER: address = @0xC1;
    const READING_TS: u64 = 1_000_000_000;
    const TEST_DEVICE_PK: vector<u8> =
        x"02337cca2171fdbfcfd657fa59881f46269f1e590b5ffab6023686c7ad2ecc2c1c";
    const TEST_DEVICE_SK: vector<u8> =
        x"42258dcda14cf111c602b8971b8cc843e91e46ca905151c02744a6b017e69316";

    fun setup_usdc_currency(scenario: &mut ts::Scenario) {
        ts::next_tx(scenario, ADMIN);
        {
            let ctx = ts::ctx(scenario);
            usdc::usdc::init_currency_for_testing(ctx);
        };
    }

    #[test]
    fun test_pyth_sync_updates_feed() {
        let mut scenario = ts::begin(ADMIN);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let feed = usdc_settlement::create_price_feed(100, READING_TS, 50, ctx);
            usdc_settlement::share_price_feed(feed);
            let clock = clock::create_for_testing(ctx);
            clock::share_for_testing(clock);
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut feed = ts::take_shared<usdc_settlement::PriceFeed>(&scenario);
            let mut clock = ts::take_shared<Clock>(&scenario);
            clock::set_for_testing(&mut clock, READING_TS + 10_000);
            pyth_price_sync::apply_pyth_snapshot(
                &mut feed,
                2_000_000,
                6,
                0,
                READING_TS + 5_000,
                &clock,
            );
            assert!(usdc_settlement::price_feed_price(&feed) == 2, 0);
            ts::return_shared(feed);
            ts::return_shared(clock);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_native_usdc_settlement() {
        let mut scenario = ts::begin(PRODUCER);
        setup_usdc_currency(&mut scenario);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let (treasury_cap, admin) = energy_token::init_for_testing(ctx);
            treasury_guard::wrap_and_share(&admin, treasury_cap, ctx);
            let mut compliance = compliance_registry::create_registry(ctx);
            compliance_registry::upsert_kyc_record(
                &admin,
                &mut compliance,
                PRODUCER,
                compliance_registry::kyc_cleared(),
                840,
                9_999_999_999_999,
            );
            compliance_registry::upsert_kyc_record(
                &admin,
                &mut compliance,
                BUYER,
                compliance_registry::kyc_cleared(),
                840,
                9_999_999_999_999,
            );
            meter_registry::register_device(&admin, TEST_DEVICE_PK, PRODUCER, ctx);
            let feed = usdc_settlement::create_price_feed(1_000_000, READING_TS, 100, ctx);
            usdc_settlement::share_price_feed(feed);
            let marketplace = usdc_settlement::create_marketplace(BUYER, ctx);
            usdc_settlement::share_marketplace(marketplace);
            compliance_registry::share_registry(compliance);
            transfer::public_transfer(admin, ADMIN);
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin = ts::take_from_address<AdminCap>(&scenario, ADMIN);
            let mut meter = ts::take_shared<EnergyMeter>(&scenario);
            meter_registry::certify_device(&admin, &mut meter);
            ts::return_shared(meter);
            transfer::public_transfer(admin, ADMIN);
        };
        ts::later_epoch(&mut scenario, READING_TS, PRODUCER);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let mut meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let energy_coin = minting_engine::mint_energy_for_testing(
                &mut guard,
                &mut meter,
                1,
                READING_TS,
                x"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
                energy_token::source_solar(),
                &compliance,
                ctx,
            );
            transfer::public_transfer(energy_coin, PRODUCER);
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut treasury = ts::take_shared<coin::TreasuryCap<USDC>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let usdc_coin = usdc::usdc::mint_for_testing(&mut treasury, 1_000_000, ctx);
            transfer::public_transfer(usdc_coin, PRODUCER);
            ts::return_shared(treasury);
        };
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let energy_coin = ts::take_from_address<coin::Coin<ENERGY>>(&scenario, PRODUCER);
            let usdc_coin = ts::take_from_address<coin::Coin<USDC>>(&scenario, PRODUCER);
            let marketplace = ts::take_shared<usdc_settlement::EnergyMarketplace>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let price_feed = ts::take_shared<usdc_settlement::PriceFeed>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            native_usdc_settlement::settle_native_usdc(
                &marketplace,
                &compliance,
                &price_feed,
                energy_coin,
                usdc_coin,
                50,
                0,
                ctx,
            );
            ts::return_shared(marketplace);
            ts::return_shared(compliance);
            ts::return_shared(price_feed);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_wormhole_core_bridge_rec() {
        let mut scenario = ts::begin(PRODUCER);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let (treasury_cap, admin) = energy_token::init_for_testing(ctx);
            treasury_guard::wrap_and_share(&admin, treasury_cap, ctx);
            let mut compliance = compliance_registry::create_registry(ctx);
            compliance_registry::upsert_kyc_record(
                &admin,
                &mut compliance,
                PRODUCER,
                compliance_registry::kyc_cleared(),
                840,
                9_999_999_999_999,
            );
            meter_registry::register_device(&admin, TEST_DEVICE_PK, PRODUCER, ctx);
            compliance_registry::share_registry(compliance);
            carbon_bridge::share_whitelist(carbon_bridge::create_whitelist(ctx));
            wormhole_core::share_wormhole_state(wormhole_core::init_wormhole_state(0, ctx));
            let clock = clock::create_for_testing(ctx);
            clock::share_for_testing(clock);
            transfer::public_transfer(admin, ADMIN);
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin = ts::take_from_address<AdminCap>(&scenario, ADMIN);
            let mut meter = ts::take_shared<EnergyMeter>(&scenario);
            meter_registry::certify_device(&admin, &mut meter);
            ts::return_shared(meter);
            transfer::public_transfer(admin, ADMIN);
        };
        ts::later_epoch(&mut scenario, READING_TS, PRODUCER);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let mut meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let sig = oracle_attestation::sign_attestation_for_test(&meter, 500, READING_TS, &TEST_DEVICE_SK);
            let ctx = ts::ctx(&mut scenario);
            let coin = minting_engine::mint_energy_for_testing(
                &mut guard,
                &mut meter,
                500,
                READING_TS,
                sig,
                energy_token::source_solar(),
                &compliance,
                ctx,
            );
            transfer::public_transfer(coin, PRODUCER);
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut wl = ts::take_shared<carbon_bridge::BridgeWhitelist>(&scenario);
            carbon_bridge::whitelist_chain(&mut wl, 2);
            ts::return_shared(wl);
        };
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let batch = ts::take_from_address<energy_token::EnergyBatch>(&scenario, PRODUCER);
            let meter = ts::take_shared<EnergyMeter>(&scenario);
            let mut wormhole_state = ts::take_shared<WormholeCoreState>(&scenario);
            let mut wl = ts::take_shared<carbon_bridge::BridgeWhitelist>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let clock = ts::take_shared<Clock>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let mut emitter = wormhole_core::create_emitter_cap(&wormhole_state, ctx);
            let fee = sui::coin::mint_for_testing(0, ctx);
            let ticket = carbon_bridge::bridge_rec_core(
                batch,
                &meter,
                &mut emitter,
                &mut wormhole_state,
                fee,
                &mut wl,
                &compliance,
                2,
                &clock,
                ctx,
            );
            transfer::public_transfer(ticket, PRODUCER);
            transfer::public_transfer(emitter, PRODUCER);
            ts::return_shared(meter);
            ts::return_shared(wormhole_state);
            ts::return_shared(wl);
            ts::return_shared(compliance);
            ts::return_shared(clock);
        };
        ts::end(scenario);
    }
}
