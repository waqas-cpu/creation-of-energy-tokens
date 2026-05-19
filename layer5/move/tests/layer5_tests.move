#[test_only]
module energy_settlement::layer5_tests {
    use sui::coin::{Self, Coin};
    use sui::test_scenario::{Self as ts};
    use sui::transfer;

    use energy_grid::compliance_registry::{Self, ComplianceRegistry};
    use energy_grid::energy_token::{Self, AdminCap, ENERGY, EnergyBatch, EnergyMeter};
    use energy_grid::errors;
    use energy_grid::meter_registry;
    use energy_grid::minting_engine;
    use energy_grid::treasury_guard::{Self, TreasuryGuard};

    use energy_settlement::carbon_bridge;
    use energy_settlement::credit_validation;
    use energy_settlement::billing_operator;
    use energy_settlement::jurisdiction_policy;
    use energy_settlement::grid_ledger;
    use energy_settlement::l5_errors;
    use energy_settlement::redemption_orchestrator;
    use energy_settlement::redemption_registry;
    use energy_settlement::usdc_settlement::{Self, USDC};
    use energy_settlement::utility_billing;

    const ADMIN: address = @0xAD;
    const PRODUCER: address = @0xB0;
    const CONSUMER: address = @0xC0;
    const DEVICE_PK: vector<u8> = x"034200000000000000000000000000000000000000000000000000000000000000";
    const DUMMY_SIG: vector<u8> =
        x"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    const READING_TS: u64 = 1_000_000_000;
    const REDEMPTION_ID: vector<u8> = b"redemption-uuid-v4-test-01";

    fun setup(scenario: &mut ts::Scenario) {
        ts::next_tx(scenario, ADMIN);
        {
            let ctx = ts::ctx(scenario);
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
                CONSUMER,
                compliance_registry::kyc_cleared(),
                840,
                9_999_999_999_999,
            );
            meter_registry::register_device(&admin, DEVICE_PK, PRODUCER, ctx);
            let mut policy = jurisdiction_policy::create(ctx);
            jurisdiction_policy::allow_cross_border(&admin, &mut policy, 840, 840);
            jurisdiction_policy::share(policy);
            let billing_op = billing_operator::create(&admin, ctx);
            transfer::public_transfer(billing_op, ADMIN);
            redemption_registry::share_registry(redemption_registry::create_registry(ctx));
            grid_ledger::share_ledger(grid_ledger::create_ledger(1, ctx));
            transfer::public_transfer(grid_ledger::create_cap(ctx), ADMIN);
            transfer::public_transfer(admin, ADMIN);
            compliance_registry::share_registry(compliance);
        };
        ts::next_tx(scenario, ADMIN);
        {
            let admin = ts::take_from_address<AdminCap>(scenario, ADMIN);
            let mut meter = ts::take_shared<EnergyMeter>(scenario);
            meter_registry::certify_device(&admin, &mut meter);
            ts::return_shared(meter);
            transfer::public_transfer(admin, ADMIN);
        };
        ts::later_epoch(scenario, READING_TS, PRODUCER);
    }

    fun mint_batch_and_coin(scenario: &mut ts::Scenario, kwh: u64) {
        ts::next_tx(scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(scenario);
            let mut meter = ts::take_shared<EnergyMeter>(scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(scenario);
            let ctx = ts::ctx(scenario);
            let coin = minting_engine::mint_energy_for_testing(
                &mut guard,
                &mut meter,
                kwh,
                READING_TS,
                DUMMY_SIG,
                energy_token::source_solar(),
                &compliance,
                ctx,
            );
            transfer::public_transfer(coin, PRODUCER);
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
        };
    }

    #[test]
    fun test_redeem_billing_happy_path() {
        let mut scenario = ts::begin(CONSUMER);
        setup(&mut scenario);
        let kwh = 1000u64;
        mint_batch_and_coin(&mut scenario, kwh);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let coin = ts::take_from_address<Coin<ENERGY>>(&scenario, PRODUCER);
            let batch = ts::take_from_address<EnergyBatch>(&scenario, PRODUCER);
            transfer::public_transfer(coin, CONSUMER);
            transfer::public_transfer(batch, CONSUMER);
        };
        ts::next_tx(&mut scenario, CONSUMER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let coin = ts::take_from_address<Coin<ENERGY>>(&scenario, CONSUMER);
            let mut batch = ts::take_from_address<EnergyBatch>(&scenario, CONSUMER);
            let meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let jurisdiction = ts::take_shared<jurisdiction_policy::JurisdictionPolicy>(&scenario);
            let billing_op = ts::take_from_address<billing_operator::BillingOperatorCap>(&scenario, ADMIN);
            let mut reg = ts::take_shared<redemption_registry::RedemptionRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let receipt = utility_billing::redeem_billing(
                &mut guard,
                &mut batch,
                coin,
                &meter,
                &compliance,
                &jurisdiction,
                &mut reg,
                REDEMPTION_ID,
                kwh,
                READING_TS,
                false,
                &billing_op,
                ctx,
            );
            utility_billing::transfer_receipt(receipt, CONSUMER);
            ts::return_to_address(ADMIN, billing_op);
            transfer::public_transfer(batch, CONSUMER);
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
            ts::return_shared(jurisdiction);
            ts::return_shared(reg);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 501)]
    fun test_insufficient_balance_reverts() {
        let mut scenario = ts::begin(CONSUMER);
        setup(&mut scenario);
        mint_batch_and_coin(&mut scenario, 1000);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut coin = ts::take_from_address<Coin<ENERGY>>(&scenario, PRODUCER);
            let batch = ts::take_from_address<EnergyBatch>(&scenario, PRODUCER);
            let ctx = ts::ctx(&mut scenario);
            let partial = coin::split(&mut coin, 1, ctx);
            transfer::public_transfer(coin, PRODUCER);
            transfer::public_transfer(partial, CONSUMER);
            transfer::public_transfer(batch, CONSUMER);
        };
        ts::next_tx(&mut scenario, CONSUMER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let coin = ts::take_from_address<Coin<ENERGY>>(&scenario, CONSUMER);
            let mut batch = ts::take_from_address<EnergyBatch>(&scenario, CONSUMER);
            let meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let jurisdiction = ts::take_shared<jurisdiction_policy::JurisdictionPolicy>(&scenario);
            let billing_op = ts::take_from_address<billing_operator::BillingOperatorCap>(&scenario, ADMIN);
            let mut reg = ts::take_shared<redemption_registry::RedemptionRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let receipt = utility_billing::redeem_billing(
                &mut guard,
                &mut batch,
                coin,
                &meter,
                &compliance,
                &jurisdiction,
                &mut reg,
                REDEMPTION_ID,
                1000,
                READING_TS,
                false,
                &billing_op,
                ctx,
            );
            utility_billing::transfer_receipt(receipt, CONSUMER);
            ts::return_to_address(ADMIN, billing_op);
            transfer::public_transfer(batch, CONSUMER);
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
            ts::return_shared(jurisdiction);
            ts::return_shared(reg);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 502)]
    fun test_double_redemption_reverts() {
        let mut scenario = ts::begin(CONSUMER);
        setup(&mut scenario);
        mint_batch_and_coin(&mut scenario, 500);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let coin = ts::take_from_address<Coin<ENERGY>>(&scenario, PRODUCER);
            let batch = ts::take_from_address<EnergyBatch>(&scenario, PRODUCER);
            transfer::public_transfer(coin, CONSUMER);
            transfer::public_transfer(batch, CONSUMER);
        };
        ts::next_tx(&mut scenario, CONSUMER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let coin = ts::take_from_address<Coin<ENERGY>>(&scenario, CONSUMER);
            let mut batch = ts::take_from_address<EnergyBatch>(&scenario, CONSUMER);
            let meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let jurisdiction = ts::take_shared<jurisdiction_policy::JurisdictionPolicy>(&scenario);
            let billing_op = ts::take_from_address<billing_operator::BillingOperatorCap>(&scenario, ADMIN);
            let mut reg = ts::take_shared<redemption_registry::RedemptionRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let receipt = utility_billing::redeem_billing(
                &mut guard,
                &mut batch,
                coin,
                &meter,
                &compliance,
                &jurisdiction,
                &mut reg,
                REDEMPTION_ID,
                500,
                READING_TS,
                false,
                &billing_op,
                ctx,
            );
            utility_billing::transfer_receipt(receipt, CONSUMER);
            ts::return_to_address(ADMIN, billing_op);
            transfer::public_transfer(batch, CONSUMER);
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
            ts::return_shared(jurisdiction);
            ts::return_shared(reg);
        };
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let coin = coin::mint(
                treasury_guard::borrow_treasury_for_burn(&mut guard),
                500 * energy_token::kwh_scale(),
                ctx,
            );
            transfer::public_transfer(coin, CONSUMER);
            ts::return_shared(guard);
        };
        ts::next_tx(&mut scenario, CONSUMER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let coin = ts::take_from_address<Coin<ENERGY>>(&scenario, CONSUMER);
            let mut batch = ts::take_from_address<EnergyBatch>(&scenario, CONSUMER);
            let meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let jurisdiction = ts::take_shared<jurisdiction_policy::JurisdictionPolicy>(&scenario);
            let billing_op = ts::take_from_address<billing_operator::BillingOperatorCap>(&scenario, ADMIN);
            let mut reg = ts::take_shared<redemption_registry::RedemptionRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let receipt = utility_billing::redeem_billing(
                &mut guard,
                &mut batch,
                coin,
                &meter,
                &compliance,
                &jurisdiction,
                &mut reg,
                b"second-id",
                500,
                READING_TS,
                false,
                &billing_op,
                ctx,
            );
            utility_billing::transfer_receipt(receipt, CONSUMER);
            ts::return_to_address(ADMIN, billing_op);
            transfer::public_transfer(batch, CONSUMER);
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
            ts::return_shared(jurisdiction);
            ts::return_shared(reg);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_carbon_bridge_consumes_batch() {
        let mut scenario = ts::begin(PRODUCER);
        setup(&mut scenario);
        mint_batch_and_coin(&mut scenario, 2000);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            carbon_bridge::share_whitelist(carbon_bridge::create_whitelist(ctx));
            carbon_bridge::share_wormhole(carbon_bridge::init_wormhole(ctx));
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut wl = ts::take_shared<carbon_bridge::BridgeWhitelist>(&scenario);
            carbon_bridge::whitelist_chain(&mut wl, 2);
            ts::return_shared(wl);
        };
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let batch = ts::take_from_address<EnergyBatch>(&scenario, PRODUCER);
            let mut wormhole = ts::take_shared<carbon_bridge::WormholeState>(&scenario);
            let mut wl = ts::take_shared<carbon_bridge::BridgeWhitelist>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let ticket = carbon_bridge::bridge_rec_skip_oracle(batch, &mut wormhole, &mut wl, &compliance, 2, ctx);
            transfer::public_transfer(ticket, PRODUCER);
            ts::return_shared(wormhole);
            ts::return_shared(wl);
            ts::return_shared(compliance);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 504)]
    fun test_grid_source_ineligible_for_rec() {
        let mut scenario = ts::begin(PRODUCER);
        setup(&mut scenario);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let mut meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let coin = minting_engine::mint_energy_for_testing(
                &mut guard,
                &mut meter,
                100,
                READING_TS,
                DUMMY_SIG,
                energy_token::source_grid(),
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
            let ctx = ts::ctx(&mut scenario);
            carbon_bridge::share_whitelist(carbon_bridge::create_whitelist(ctx));
            carbon_bridge::share_wormhole(carbon_bridge::init_wormhole(ctx));
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut wl = ts::take_shared<carbon_bridge::BridgeWhitelist>(&scenario);
            carbon_bridge::whitelist_chain(&mut wl, 2);
            ts::return_shared(wl);
        };
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let batch = ts::take_from_address<EnergyBatch>(&scenario, PRODUCER);
            let mut wormhole = ts::take_shared<carbon_bridge::WormholeState>(&scenario);
            let mut wl = ts::take_shared<carbon_bridge::BridgeWhitelist>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let ticket = carbon_bridge::bridge_rec_skip_oracle(batch, &mut wormhole, &mut wl, &compliance, 2, ctx);
            transfer::public_transfer(ticket, PRODUCER);
            ts::return_shared(wormhole);
            ts::return_shared(wl);
            ts::return_shared(compliance);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_orchestrator_atomic_redeem() {
        let mut scenario = ts::begin(CONSUMER);
        setup(&mut scenario);
        mint_batch_and_coin(&mut scenario, 750);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let coin = ts::take_from_address<Coin<ENERGY>>(&scenario, PRODUCER);
            let batch = ts::take_from_address<EnergyBatch>(&scenario, PRODUCER);
            transfer::public_transfer(coin, CONSUMER);
            transfer::public_transfer(batch, CONSUMER);
        };
        ts::next_tx(&mut scenario, CONSUMER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let coin = ts::take_from_address<Coin<ENERGY>>(&scenario, CONSUMER);
            let mut batch = ts::take_from_address<EnergyBatch>(&scenario, CONSUMER);
            let meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let jurisdiction = ts::take_shared<jurisdiction_policy::JurisdictionPolicy>(&scenario);
            let billing_op = ts::take_from_address<billing_operator::BillingOperatorCap>(&scenario, ADMIN);
            let mut reg = ts::take_shared<redemption_registry::RedemptionRegistry>(&scenario);
            let cap = ts::take_from_address<grid_ledger::GridOperatorCap>(&scenario, ADMIN);
            let mut ledger = ts::take_shared<grid_ledger::GridSettlementLedger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            redemption_orchestrator::redeem_atomic(
                &mut guard,
                &mut batch,
                coin,
                &meter,
                &compliance,
                &jurisdiction,
                &mut reg,
                &cap,
                &billing_op,
                &mut ledger,
                REDEMPTION_ID,
                750,
                READING_TS,
                false,
                0,
                ctx,
            );
            ts::return_to_address(ADMIN, billing_op);
            transfer::public_transfer(batch, CONSUMER);
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
            ts::return_shared(jurisdiction);
            ts::return_shared(reg);
            ts::return_to_address(ADMIN, cap);
            ts::return_shared(ledger);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_credit_validation_read_only() {
        let mut scenario = ts::begin(PRODUCER);
        setup(&mut scenario);
        mint_batch_and_coin(&mut scenario, 100);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let coin = ts::take_from_address<Coin<ENERGY>>(&scenario, PRODUCER);
            let batch = ts::take_from_address<EnergyBatch>(&scenario, PRODUCER);
            credit_validation::validate_credit(&coin, &batch, 100);
            assert!(credit_validation::calculate_max_credit(&coin, &batch) == 100, 0);
            transfer::public_transfer(coin, PRODUCER);
            transfer::public_transfer(batch, PRODUCER);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_l5_error_codes() {
        assert!(l5_errors::insufficient_balance() == 501, 0);
        assert!(errors::already_redeemed() == 6, 0);
    }
}
