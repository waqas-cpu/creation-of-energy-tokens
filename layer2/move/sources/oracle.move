/// G-L2-06 — Layer 2 oracle entry: verify_reading + events (PTB step 1).
module energy_oracle::oracle {
    use std::option::Option;
    use sui::tx_context::{Self, TxContext};

    use energy_oracle::aggregator::{Self, AggregatedReading, OracleAggregator, SpentProofs};
    use energy_oracle::attestation::{Self, ProcessedAttestationTable};
    use energy_oracle::compliance_bridge::{ComplianceRegistry, JurisdictionBlacklist};
    use energy_oracle::crypto;
    use energy_oracle::device_registry::{Self, DeviceRegistry, EnergyMeter};
    use energy_oracle::errors;
    use energy_oracle::types::{Self, CanonicalAttestation, EnergyAttestation, VerifiedReading};
    use energy_oracle::zk_attestation::{Self, ZkPublicInputs, ZkRegistry};

    public struct ReadingProof has copy, drop {
        attestation_hash: vector<u8>,
        median_kwh: u64,
        timestamp: u64,
    }

    public fun verify_reading(
        att: EnergyAttestation,
        registry: &DeviceRegistry,
        processed: &mut ProcessedAttestationTable,
        meter: &EnergyMeter,
        ctx: &mut TxContext,
    ): ReadingProof {
        verify_reading_internal(att, registry, processed, meter, false, ctx)
    }

    public fun verify_reading_with_zk(
        att: EnergyAttestation,
        registry: &DeviceRegistry,
        processed: &mut ProcessedAttestationTable,
        meter: &EnergyMeter,
        zk_reg: &ZkRegistry,
        proof: vector<u8>,
        public_inputs_bytes: vector<u8>,
        vk_hash: vector<u8>,
        circuit_hash: vector<u8>,
        inputs: ZkPublicInputs,
        geohash_commitment: vector<u8>,
        certified_geohash: vector<u8>,
        kwh_commitment: vector<u8>,
        ctx: &mut TxContext,
    ): ReadingProof {
        let now_ms = tx_context::epoch_timestamp_ms(ctx);
        assert_gas_budget(true);

        let canonical = attestation::ingest(att, registry, processed, meter, now_ms, 0);

        let zk_valid = zk_attestation::verify_zk_attestation(
            zk_reg,
            &proof,
            &public_inputs_bytes,
            &vk_hash,
            &circuit_hash,
            &inputs,
            &geohash_commitment,
            types::canonical_timestamp_ms(&canonical),
            &kwh_commitment,
            &certified_geohash,
            now_ms,
        );

        let crypto_proof = crypto::verify_and_prove(&canonical, meter, zk_valid);
        crypto::assert_combined(&crypto_proof, true);
        emit_verification_event(*types::proof_hash(&crypto_proof), 1, true, now_ms);

        ReadingProof {
            attestation_hash: *types::proof_hash(&crypto_proof),
            median_kwh: types::canonical_kwh(&canonical),
            timestamp: types::canonical_timestamp_ms(&canonical),
        }
    }

    fun verify_reading_internal(
        att: EnergyAttestation,
        registry: &DeviceRegistry,
        processed: &mut ProcessedAttestationTable,
        meter: &EnergyMeter,
        zk_required: bool,
        ctx: &mut TxContext,
    ): ReadingProof {
        let now_ms = tx_context::epoch_timestamp_ms(ctx);
        assert_gas_budget(zk_required);

        let canonical = attestation::ingest(att, registry, processed, meter, now_ms, 0);
        let proof = crypto::verify_and_prove(&canonical, meter, !zk_required);
        crypto::assert_combined(&proof, zk_required);
        emit_verification_event(*types::proof_hash(&proof), 1, true, now_ms);

        ReadingProof {
            attestation_hash: *types::proof_hash(&proof),
            median_kwh: types::canonical_kwh(&canonical),
            timestamp: types::canonical_timestamp_ms(&canonical),
        }
    }

    public fun verify_reading_batch(
        attestations: vector<EnergyAttestation>,
        registry: &DeviceRegistry,
        processed: &mut ProcessedAttestationTable,
        meter: &EnergyMeter,
        aggregator: &OracleAggregator,
        spent: &mut SpentProofs,
        oracle_signers: vector<address>,
        batch_nonce: u64,
        has_plausibility: bool,
        ctx: &mut TxContext,
    ): (ReadingProof, AggregatedReading) {
        let now_ms = tx_context::epoch_timestamp_ms(ctx);
        assert_gas_budget(false);

        let mut canonicals = vector::empty<CanonicalAttestation>();
        let mut i = 0;
        let len = vector::length(&attestations);
        while (i < len) {
            let att = *vector::borrow(&attestations, i);
            vector::push_back(
                &mut canonicals,
                attestation::ingest(att, registry, processed, meter, now_ms, 0),
            );
            let c = vector::borrow(&canonicals, i);
            let _ = crypto::verify_ecdsa(c, meter);
            i = i + 1;
        };

        let meter_id = *device_registry::meter_device_id(meter);
        let agg = aggregator::aggregate_batch(
            aggregator,
            spent,
            canonicals,
            oracle_signers,
            meter_id,
            batch_nonce,
            has_plausibility,
        );

        let hash = aggregator::agg_threshold_sig(&agg);
        emit_verification_event(hash, 2, true, now_ms);

        (
            ReadingProof {
                attestation_hash: hash,
                median_kwh: aggregator::agg_median_kwh(&agg),
                timestamp: aggregator::agg_timestamp(&agg),
            },
            agg,
        )
    }

    public fun assert_producer_for_mint(
        compliance: &ComplianceRegistry,
        blacklist: &JurisdictionBlacklist,
        meter: &EnergyMeter,
        ctx: &mut TxContext,
    ): u8 {
        let producer = device_registry::producer_addr(meter);
        let now_ms = tx_context::epoch_timestamp_ms(ctx);
        energy_oracle::compliance_bridge::assert_producer(compliance, blacklist, producer, now_ms)
    }

    public fun finalize_layer2_verification(
        reading: &ReadingProof,
        compliance: &ComplianceRegistry,
        blacklist: &JurisdictionBlacklist,
        meter: &EnergyMeter,
        oracle_nodes: vector<address>,
        zk_vk_hash: Option<vector<u8>>,
        ctx: &mut TxContext,
    ): VerifiedReading {
        let kyc_status = assert_producer_for_mint(compliance, blacklist, meter, ctx);
        let now_ms = tx_context::epoch_timestamp_ms(ctx);

        types::emit_layer2_verified(
            reading.attestation_hash,
            oracle_nodes,
            zk_vk_hash,
            kyc_status,
            now_ms,
        );

        types::mint_verified_reading(
            device_registry::meter_id(meter),
            reading.median_kwh,
            reading.timestamp,
            reading.attestation_hash,
            ctx,
        )
    }

    fun assert_gas_budget(zk_enabled: bool) {
        let budget = if (zk_enabled) {
            types::gas_budget_zk_mist()
        } else {
            types::gas_budget_standard_mist()
        };
        assert!(budget <= types::gas_budget_zk_mist(), errors::gas_budget_exceeded());
    }

    fun emit_verification_event(
        batch_id: vector<u8>,
        verifier_type: u8,
        success: bool,
        block_timestamp: u64,
    ) {
        types::emit_oracle_verification(batch_id, verifier_type, success, block_timestamp);
    }
}
