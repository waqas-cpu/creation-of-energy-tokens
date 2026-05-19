#[test_only]
module energy_settlement::gate_tests {
    use sui::coin::{Self, Coin};
    use sui::test_scenario::{Self as ts};
    use sui::transfer;

    use energy_grid::compliance_registry::{Self, ComplianceRegistry};
    use energy_grid::energy_token::{Self, AdminCap, ENERGY, EnergyBatch, EnergyMeter};
    use energy_grid::meter_registry;
    use energy_grid::minting_engine;
    use energy_grid::treasury_guard::{Self, TreasuryGuard};

    use energy_settlement::billing_operator;
    use energy_settlement::carbon_bridge;
    use energy_settlement::jurisdiction_policy;
    use energy_settlement::oracle_attestation;
    use energy_settlement::redemption_registry;
    use energy_settlement::utility_billing;

    const ADMIN: address = @0xAD;
    const PRODUCER: address = @0xB0;
    const CONSUMER: address = @0xC0;
    const READING_TS: u64 = 1_000_000_000;
    const STALE_PERIOD_END: u64 = 1;
    const REDEMPTION_ID: vector<u8> = b"gate-test-redemption-01";
    const DUMMY_SIG: vector<u8> =
        x"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    const TEST_DEVICE_PK: vector<u8> =
        x"02337cca2171fdbfcfd657fa59881f46269f1e590b5ffab6023686c7ad2ecc2c1c";
    const TEST_DEVICE_SK: vector<u8> =
        x"42258dcda14cf111c602b8971b8cc843e91e46ca905151c02744a6b017e69316";

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
            meter_registry::register_device(&admin, TEST_DEVICE_PK, PRODUCER, ctx);
            let mut policy = jurisdiction_policy::create(ctx);
            jurisdiction_policy::allow_cross_border(&admin, &mut policy, 840, 840);
            jurisdiction_policy::share(policy);
            let billing_op = billing_operator::create(&admin, ctx);
            transfer::public_transfer(billing_op, ADMIN);
            redemption_registry::share_registry(redemption_registry::create_registry(ctx));
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

    fun mint_with_sig(
        scenario: &mut ts::Scenario,
        kwh: u64,
        sig: vector<u8>,
    ) {
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
    }

    #[test]
    #[expected_failure(abort_code = 516)]
    fun test_billing_period_mismatch_without_override() {
        let mut scenario = ts::begin(CONSUMER);
        setup(&mut scenario);
        mint_with_sig(&mut scenario, 100, DUMMY_SIG);
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
                100,
                STALE_PERIOD_END,
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
    fun test_billing_period_override_with_operator_cap() {
        let mut scenario = ts::begin(CONSUMER);
        setup(&mut scenario);
        mint_with_sig(&mut scenario, 100, DUMMY_SIG);
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
                100,
                STALE_PERIOD_END,
                true,
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
    #[expected_failure(abort_code = 515)]
    fun test_bridge_rec_invalid_oracle_sig() {
        let mut scenario = ts::begin(PRODUCER);
        setup(&mut scenario);
        mint_with_sig(&mut scenario, 500, DUMMY_SIG);
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
            let meter = ts::take_shared<EnergyMeter>(&scenario);
            let mut wormhole = ts::take_shared<carbon_bridge::WormholeState>(&scenario);
            let mut wl = ts::take_shared<carbon_bridge::BridgeWhitelist>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let ticket = carbon_bridge::bridge_rec(
                batch,
                &meter,
                &mut wormhole,
                &mut wl,
                &compliance,
                2,
                ctx,
            );
            transfer::public_transfer(ticket, PRODUCER);
            ts::return_shared(meter);
            ts::return_shared(wormhole);
            ts::return_shared(wl);
            ts::return_shared(compliance);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_bridge_rec_valid_oracle_sig() {
        let mut scenario = ts::begin(PRODUCER);
        setup(&mut scenario);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let mut meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let sig = oracle_attestation::sign_attestation_for_test(
                &meter,
                500,
                READING_TS,
                &TEST_DEVICE_SK,
            );
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
            let meter = ts::take_shared<EnergyMeter>(&scenario);
            let mut wormhole = ts::take_shared<carbon_bridge::WormholeState>(&scenario);
            let mut wl = ts::take_shared<carbon_bridge::BridgeWhitelist>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let ticket = carbon_bridge::bridge_rec(
                batch,
                &meter,
                &mut wormhole,
                &mut wl,
                &compliance,
                2,
                ctx,
            );
            transfer::public_transfer(ticket, PRODUCER);
            ts::return_shared(meter);
            ts::return_shared(wormhole);
            ts::return_shared(wl);
            ts::return_shared(compliance);
        };
        ts::end(scenario);
    }
}
