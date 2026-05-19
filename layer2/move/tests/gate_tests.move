#[test_only]
module energy_oracle::gate_tests {
    use sui::test_scenario::{Self as ts};
    use sui::transfer;

    use energy_oracle::aggregator;
    use energy_oracle::attestation;
    use energy_oracle::compliance_bridge::{Self, ComplianceRegistry, JurisdictionBlacklist};
    use energy_oracle::device_registry::{Self, EnergyMeter};
    use energy_oracle::errors;
    use energy_oracle::pyth_validation::{Self, PriceFeedRegistry};
    use energy_oracle::types::{Self, EnergyAttestation};
    use energy_oracle::zk_attestation::{Self, ZkRegistry};

    const ADMIN: address = @0xAD;
    const PRODUCER: address = @0xB0;
    const DEVICE: vector<u8> = b"device-solar-001-test-id-12";
    const SAMPLE_SIG: vector<u8> =
        x"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    fun sample_attestation(timestamp: u64, kwh: u64): EnergyAttestation {
        types::new_energy_attestation(DEVICE, kwh, timestamp, SAMPLE_SIG)
    }

    #[test]
    #[expected_failure(abort_code = 20005)]
    fun test_schema_rejects_empty_device() {
        let att = types::new_energy_attestation(vector[], 1, 1000, vector[]);
        attestation::validate_schema(&att);
    }

    #[test]
    #[expected_failure(abort_code = 20003)]
    fun test_stale_timestamp_reverts() {
        let now = 1_000_000_000;
        let att = sample_attestation(now - types::timestamp_drift_ms() - 1, 1_000_000);
        attestation::assert_timestamp_fresh(&att, now);
    }

    #[test]
    #[expected_failure(abort_code = 20006)]
    fun test_future_timestamp_reverts() {
        let now = 1_000_000_000;
        let att = sample_attestation(now + 120_000, 1_000_000);
        attestation::assert_timestamp_fresh(&att, now);
    }

    #[test]
    fun test_quorum_threshold_ceil_2n_3() {
        assert!(aggregator::quorum_threshold(5) == 4, 0);
        assert!(aggregator::quorum_threshold(7) == 5, 0);
        assert!(aggregator::quorum_threshold(3) == 2, 0);
    }

    #[test]
    #[expected_failure(abort_code = 20020)]
    fun test_quorum_not_reached_reverts() {
        let mut scenario = ts::begin(ADMIN);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let agg = aggregator::create_aggregator(
                vector[@0x1, @0x2, @0x3, @0x4, @0x5],
                ctx,
            );
            transfer::public_transfer(agg, ADMIN);
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let agg = ts::take_from_address<aggregator::OracleAggregator>(&scenario, ADMIN);
            aggregator::assert_quorum(&agg, 2);
            ts::return_to_sender(&mut scenario, agg);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 20041)]
    fun test_expired_kyc_reverts() {
        let mut scenario = ts::begin(ADMIN);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut reg = compliance_bridge::create_registry(vector[], ctx);
            let blacklist = compliance_bridge::create_blacklist(ctx);
            compliance_bridge::upsert_kyc(
                &mut reg,
                PRODUCER,
                compliance_bridge::new_kyc_record(
                    types::kyc_cleared(),
                    840,
                    100,
                    1,
                ),
            );
            transfer::public_transfer(reg, ADMIN);
            transfer::public_transfer(blacklist, ADMIN);
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let reg = ts::take_from_address<ComplianceRegistry>(&scenario, ADMIN);
            let blacklist = ts::take_from_address<JurisdictionBlacklist>(&scenario, ADMIN);
            compliance_bridge::assert_producer(&reg, &blacklist, PRODUCER, 200);
            ts::return_to_sender(&mut scenario, reg);
            ts::return_to_sender(&mut scenario, blacklist);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 20042)]
    fun test_suspended_kyc_reverts() {
        let mut scenario = ts::begin(ADMIN);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut reg = compliance_bridge::create_registry(vector[], ctx);
            let blacklist = compliance_bridge::create_blacklist(ctx);
            compliance_bridge::upsert_kyc(
                &mut reg,
                PRODUCER,
                compliance_bridge::new_kyc_record(
                    types::kyc_suspended(),
                    840,
                    9_999_999_999_999,
                    1,
                ),
            );
            transfer::public_transfer(reg, ADMIN);
            transfer::public_transfer(blacklist, ADMIN);
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let reg = ts::take_from_address<ComplianceRegistry>(&scenario, ADMIN);
            let blacklist = ts::take_from_address<JurisdictionBlacklist>(&scenario, ADMIN);
            compliance_bridge::assert_producer(&reg, &blacklist, PRODUCER, 1000);
            ts::return_to_sender(&mut scenario, reg);
            ts::return_to_sender(&mut scenario, blacklist);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 20040)]
    fun test_pending_kyc_reverts() {
        let mut scenario = ts::begin(ADMIN);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut reg = compliance_bridge::create_registry(vector[], ctx);
            let blacklist = compliance_bridge::create_blacklist(ctx);
            compliance_bridge::upsert_kyc(
                &mut reg,
                PRODUCER,
                compliance_bridge::new_kyc_record(
                    types::kyc_pending(),
                    840,
                    9_999_999_999_999,
                    1,
                ),
            );
            transfer::public_transfer(reg, ADMIN);
            transfer::public_transfer(blacklist, ADMIN);
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let reg = ts::take_from_address<ComplianceRegistry>(&scenario, ADMIN);
            let blacklist = ts::take_from_address<JurisdictionBlacklist>(&scenario, ADMIN);
            compliance_bridge::assert_producer(&reg, &blacklist, PRODUCER, 1000);
            ts::return_to_sender(&mut scenario, reg);
            ts::return_to_sender(&mut scenario, blacklist);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 20031)]
    fun test_zk_vk_mismatch_reverts() {
        let mut scenario = ts::begin(ADMIN);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let reg = zk_attestation::create_registry(b"vk1", b"circuit1", ctx);
            transfer::public_transfer(reg, ADMIN);
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let reg = ts::take_from_address<ZkRegistry>(&scenario, ADMIN);
            zk_attestation::assert_vk_hash(&reg, &b"wrong");
            ts::return_to_sender(&mut scenario, reg);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 20001)]
    fun test_duplicate_attestation_reverts() {
        let mut scenario = ts::begin(ADMIN);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let mut registry = device_registry::create_registry(ctx);
            let meter = device_registry::create_meter(
                DEVICE,
                x"034200000000000000000000000000000000000000000000000000000000000000",
                PRODUCER,
                ctx,
            );
            let meter_id = sui::object::id(&meter);
            device_registry::register_device(
                &mut registry,
                DEVICE,
                meter_id,
                9_999_999_999_999,
                ctx,
            );
            let mut processed = attestation::create_processed_table(ctx);
            let now = 1_000_000_000;
            let att = sample_attestation(now, 1_000_000);
            attestation::ingest(att, &registry, &mut processed, &meter, now, 0);
            let att2 = sample_attestation(now, 1_000_000);
            attestation::ingest(att2, &registry, &mut processed, &meter, now, 0);
            transfer::public_transfer(registry, ADMIN);
            transfer::public_transfer(meter, ADMIN);
            transfer::public_transfer(processed, ADMIN);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_median_odd_count() {
        let values = vector[3u64, 1, 9];
        assert!(aggregator::median_kwh(&values) == 3, 0);
    }

    #[test]
    #[expected_failure(abort_code = 20060)]
    fun test_pyth_unknown_feed_reverts() {
        let mut scenario = ts::begin(ADMIN);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let reg = pyth_validation::create_registry(ctx);
            transfer::public_transfer(reg, ADMIN);
        };
        ts::next_tx(&mut scenario, ADMIN);
        {
            let reg = ts::take_from_address<PriceFeedRegistry>(&scenario, ADMIN);
            let feed_id = b"unknown-feed";
            let snapshot = pyth_validation::new_price_snapshot(
                feed_id,
                1_000_000,
                10_000,
                1_000_000_000,
                1,
            );
            pyth_validation::assert_feed_whitelisted(&reg, &feed_id);
            let _ = snapshot;
            ts::return_to_sender(&mut scenario, reg);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 20061)]
    fun test_pyth_confidence_too_wide_reverts() {
        let snapshot = pyth_validation::new_price_snapshot(
            b"feed",
            100,
            50,
            1_000_000_000,
            1,
        );
        pyth_validation::assert_confidence(&snapshot);
    }

    #[test]
    fun test_error_code_range_documented() {
        assert!(errors::duplicate_attestation() == 20001, 0);
        assert!(errors::economic_plausibility() == 20065, 0);
    }
}
