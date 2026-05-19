#[test_only]
module energy_grid::layer3_tests {
    use sui::coin;
    use sui::test_scenario::{Self as ts};
    use sui::transfer;

    use energy_grid::batch_receipt;
    use energy_grid::compliance_registry::{Self, ComplianceRegistry};
    use energy_grid::energy_token::{Self, AdminCap, ENERGY, EnergyBatch, EnergyMeter};
    use energy_grid::errors;
    use energy_grid::meter_registry;
    use energy_grid::minting_engine;
    use energy_grid::treasury_guard::{Self, TreasuryGuard};

    const ADMIN: address = @0xAD;
    const PRODUCER: address = @0xB0;
    const DEVICE_PK: vector<u8> = x"034200000000000000000000000000000000000000000000000000000000000000";
    const DUMMY_SIG: vector<u8> =
        x"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    const READING_TS: u64 = 1_000_000_000;

    fun setup_world(scenario: &mut ts::Scenario, certify_meter: bool) {
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
            meter_registry::register_device(&admin, DEVICE_PK, PRODUCER, ctx);
            transfer::public_transfer(admin, ADMIN);
            compliance_registry::share_registry(compliance);
        };
        if (certify_meter) {
            ts::next_tx(scenario, ADMIN);
            {
                let admin = ts::take_from_address<AdminCap>(scenario, ADMIN);
                let mut meter_obj = ts::take_shared<EnergyMeter>(scenario);
                meter_registry::certify_device(&admin, &mut meter_obj);
                ts::return_shared(meter_obj);
                transfer::public_transfer(admin, ADMIN);
            };
        };
        ts::later_epoch(scenario, READING_TS, PRODUCER);
    }

    #[test]
    fun test_happy_path_mint() {
        let mut scenario = ts::begin(PRODUCER);
        setup_world(&mut scenario, true);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let mut meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let coin = minting_engine::mint_energy_for_testing(
                &mut guard,
                &mut meter,
                1_000_000,
                READING_TS,
                DUMMY_SIG,
                energy_token::source_solar(),
                &compliance,
                ctx,
            );
            assert!(coin::value(&coin) == 1_000_000 * energy_token::kwh_scale(), 0);
            assert!(energy_token::meter_total_kwh(&meter) == 1_000_000, 0);
            transfer::public_transfer(coin, PRODUCER);
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 0)]
    fun test_zero_mint_reverts() {
        let mut scenario = ts::begin(PRODUCER);
        setup_world(&mut scenario, true);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let mut meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            minting_engine::mint_energy_for_testing_expect_abort(
                &mut guard,
                &mut meter,
                0,
                READING_TS,
                DUMMY_SIG,
                0,
                &compliance,
                ctx,
            );
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 3)]
    fun test_uncertified_meter_reverts() {
        let mut scenario = ts::begin(PRODUCER);
        setup_world(&mut scenario, false);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let mut meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            minting_engine::mint_energy_for_testing_expect_abort(
                &mut guard,
                &mut meter,
                1000,
                READING_TS,
                DUMMY_SIG,
                0,
                &compliance,
                ctx,
            );
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 4)]
    fun test_kyc_not_cleared_reverts() {
        let mut scenario = ts::begin(PRODUCER);
        setup_world(&mut scenario, true);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin = ts::take_from_address<AdminCap>(&scenario, ADMIN);
            let mut compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            compliance_registry::upsert_kyc_record(
                &admin,
                &mut compliance,
                PRODUCER,
                compliance_registry::kyc_pending(),
                840,
                9_999_999_999_999,
            );
            ts::return_to_address(ADMIN, admin);
            ts::return_shared(compliance);
        };
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let mut meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            minting_engine::mint_energy_for_testing_expect_abort(
                &mut guard,
                &mut meter,
                1000,
                READING_TS,
                DUMMY_SIG,
                0,
                &compliance,
                ctx,
            );
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_burn_on_redemption() {
        let mut scenario = ts::begin(PRODUCER);
        setup_world(&mut scenario, true);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let mut meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let kwh = 500_000u64;
            let coin = minting_engine::mint_energy_for_testing(
                &mut guard,
                &mut meter,
                kwh,
                READING_TS,
                DUMMY_SIG,
                energy_token::source_wind(),
                &compliance,
                ctx,
            );
            transfer::public_transfer(coin, PRODUCER);
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
        };
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let coin = ts::take_from_address<coin::Coin<ENERGY>>(&scenario, PRODUCER);
            let mut batch = ts::take_from_address<EnergyBatch>(&scenario, PRODUCER);
            let ctx = ts::ctx(&mut scenario);
            minting_engine::burn_on_redemption(&mut guard, coin, &mut batch, ctx);
            assert!(batch_receipt::is_redeemed(&batch), 0);
            transfer::public_transfer(batch, PRODUCER);
            ts::return_shared(guard);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 6)]
    fun test_double_redemption_reverts() {
        let mut scenario = ts::begin(PRODUCER);
        setup_world(&mut scenario, true);
        ts::next_tx(&mut scenario, PRODUCER);
        {
            let mut guard = ts::take_shared<TreasuryGuard>(&scenario);
            let mut meter = ts::take_shared<EnergyMeter>(&scenario);
            let compliance = ts::take_shared<ComplianceRegistry>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let coin = minting_engine::mint_energy_for_testing(
                &mut guard,
                &mut meter,
                1000,
                READING_TS,
                DUMMY_SIG,
                0,
                &compliance,
                ctx,
            );
            transfer::public_transfer(coin, PRODUCER);
            ts::return_shared(guard);
            ts::return_shared(meter);
            ts::return_shared(compliance);
        };
        ts::next_tx(&mut scenario, PRODUCER);
        let mut batch = ts::take_from_address<EnergyBatch>(&scenario, PRODUCER);
        {
            batch_receipt::mark_redeemed(&mut batch);
            batch_receipt::mark_redeemed(&mut batch);
        };
        transfer::public_transfer(batch, PRODUCER);
        ts::end(scenario);
    }

    #[test]
    fun test_error_codes_documented() {
        assert!(errors::zero_mint() == 0, 0);
        assert!(errors::invalid_attestation() == 1, 0);
        assert!(errors::already_redeemed() == 6, 0);
    }
}
