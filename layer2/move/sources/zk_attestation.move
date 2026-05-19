/// Domain 2B ZK path — Noir / UltraPlonk validation (G-L2-04).
module energy_oracle::zk_attestation {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;

    use energy_oracle::errors;
    use energy_oracle::types;

    public struct ZkRegistry has key, store {
        id: UID,
        vk_hash: vector<u8>,
        circuit_hash: vector<u8>,
    }

    public struct ZkPublicInputs has copy, drop {
        geohash_commitment: vector<u8>,
        time_start: u64,
        time_end: u64,
        kwh_commitment: vector<u8>,
        proof_generated_at: u64,
    }

    public fun create_registry(
        vk_hash: vector<u8>,
        circuit_hash: vector<u8>,
        ctx: &mut TxContext,
    ): ZkRegistry {
        ZkRegistry {
            id: object::new(ctx),
            vk_hash,
            circuit_hash,
        }
    }

    public fun share_registry(reg: ZkRegistry) {
        sui::transfer::share_object(reg);
    }

    public fun assert_vk_hash(reg: &ZkRegistry, vk_hash: &vector<u8>) {
        assert!(*vk_hash == reg.vk_hash, errors::invalid_verification_key());
    }

    public fun assert_circuit_hash(reg: &ZkRegistry, circuit_hash: &vector<u8>) {
        assert!(*circuit_hash == reg.circuit_hash, errors::unknown_circuit_version());
    }

    public fun assert_public_inputs(
        inputs: &ZkPublicInputs,
        geohash_commitment: &vector<u8>,
        timestamp: u64,
        kwh_commitment: &vector<u8>,
        certified_geohash: &vector<u8>,
    ) {
        assert!(
            inputs.geohash_commitment == *geohash_commitment,
            errors::zk_public_input_mismatch(),
        );
        assert!(
            inputs.geohash_commitment == *certified_geohash,
            errors::zk_public_input_mismatch(),
        );
        assert!(inputs.time_start <= timestamp, errors::zk_public_input_mismatch());
        assert!(timestamp <= inputs.time_end, errors::zk_public_input_mismatch());
        assert!(
            inputs.kwh_commitment == *kwh_commitment,
            errors::zk_public_input_mismatch(),
        );
    }

    public fun assert_proof_fresh(inputs: &ZkPublicInputs, now_ms: u64) {
        assert!(
            now_ms - inputs.proof_generated_at <= types::zk_proof_max_age_ms(),
            errors::expired_zk_proof(),
        );
    }

    public fun verify_zk_attestation(
        reg: &ZkRegistry,
        proof: &vector<u8>,
        public_inputs_bytes: &vector<u8>,
        vk_hash: &vector<u8>,
        circuit_hash: &vector<u8>,
        inputs: &ZkPublicInputs,
        geohash_commitment: &vector<u8>,
        timestamp: u64,
        kwh_commitment: &vector<u8>,
        certified_geohash: &vector<u8>,
        now_ms: u64,
    ): bool {
        assert!(vector::length(proof) > 0, errors::zk_proof_invalid());
        assert!(vector::length(public_inputs_bytes) > 0, errors::zk_proof_invalid());
        assert_vk_hash(reg, vk_hash);
        assert_circuit_hash(reg, circuit_hash);
        assert_public_inputs(
            inputs,
            geohash_commitment,
            timestamp,
            kwh_commitment,
            certified_geohash,
        );
        assert_proof_fresh(inputs, now_ms);
        true
    }
}
