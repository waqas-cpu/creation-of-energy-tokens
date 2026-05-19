module energy_oracle::types {
    use std::option::Option;
    use sui::event;
    use sui::object::{Self, ID};
    use sui::tx_context::TxContext;

    public struct EnergyAttestation has copy, drop, store {
        device_id: vector<u8>,
        kwh_delta: u64,
        timestamp: u64,
        secp256k1_sig: vector<u8>,
    }

    public struct CanonicalAttestation has copy, drop, store {
        device_id: vector<u8>,
        kwh_delta: u64,
        timestamp_ms: u64,
        sig_bytes: vector<u8>,
        source_type: u8,
    }

    public struct CryptoProof has copy, drop, store {
        attestation_hash: vector<u8>,
        ecdsa_valid: bool,
        zk_valid: bool,
        combined_valid: bool,
    }

    public struct PlausibilityProof has key, store {
        id: sui::object::UID,
        attestation_hash: vector<u8>,
        oracle_node: address,
        passed: bool,
    }

    public struct Layer2VerifiedEvent has copy, drop {
        attestation_hash: vector<u8>,
        oracle_nodes: vector<address>,
        zk_vk_hash: Option<vector<u8>>,
        kyc_status_at_mint: u8,
        timestamp_verified: u64,
    }

    public struct OracleVerificationEvent has copy, drop {
        batch_id: vector<u8>,
        verifier_type: u8,
        success: bool,
        block_timestamp: u64,
    }

    public struct VerifiedReading has key, store {
        id: sui::object::UID,
        meter_id: ID,
        median_kwh: u64,
        timestamp: u64,
        attestation_hash: vector<u8>,
    }

    public fun kyc_pending(): u8 { 0 }
    public fun kyc_cleared(): u8 { 1 }
    public fun kyc_suspended(): u8 { 2 }
    public fun kyc_revoked(): u8 { 3 }
    public fun max_device_id_len(): u64 { 32 }
    public fun sig_len(): u64 { 65 }
    public fun timestamp_drift_ms(): u64 { 300_000 }
    public fun future_tolerance_ms(): u64 { 60_000 }
    public fun aggregation_window_ms(): u64 { 300_000 }
    public fun zk_proof_max_age_ms(): u64 { 86_400_000 }
    public fun max_confidence_bps(): u64 { 200 }
    public fun stale_price_threshold_ms(): u64 { 300_000 }
    public fun gas_budget_zk_mist(): u64 { 50_000_000 }
    public fun gas_budget_standard_mist(): u64 { 10_000_000 }
    public fun default_max_plausible_kwh(): u64 { 1_000_000_000 }

    public fun att_device_id(a: &EnergyAttestation): &vector<u8> { &a.device_id }
    public fun att_kwh_delta(a: &EnergyAttestation): u64 { a.kwh_delta }
    public fun att_timestamp(a: &EnergyAttestation): u64 { a.timestamp }
    public fun att_sig(a: &EnergyAttestation): &vector<u8> { &a.secp256k1_sig }

    public fun new_canonical(
        device_id: vector<u8>,
        kwh_delta: u64,
        timestamp_ms: u64,
        sig_bytes: vector<u8>,
        source_type: u8,
    ): CanonicalAttestation {
        CanonicalAttestation { device_id, kwh_delta, timestamp_ms, sig_bytes, source_type }
    }

    public fun canonical_device_id(c: &CanonicalAttestation): &vector<u8> { &c.device_id }
    public fun canonical_kwh(c: &CanonicalAttestation): u64 { c.kwh_delta }
    public fun canonical_timestamp_ms(c: &CanonicalAttestation): u64 { c.timestamp_ms }
    public fun canonical_sig(c: &CanonicalAttestation): &vector<u8> { &c.sig_bytes }

    public fun new_crypto_proof(
        attestation_hash: vector<u8>,
        ecdsa_valid: bool,
        zk_valid: bool,
    ): CryptoProof {
        CryptoProof {
            attestation_hash,
            ecdsa_valid,
            zk_valid,
            combined_valid: ecdsa_valid && zk_valid,
        }
    }

    public fun proof_hash(p: &CryptoProof): &vector<u8> { &p.attestation_hash }
    public fun proof_ecdsa_valid(p: &CryptoProof): bool { p.ecdsa_valid }
    public fun proof_zk_valid(p: &CryptoProof): bool { p.zk_valid }
    public fun proof_combined_valid(p: &CryptoProof): bool { p.combined_valid }

    public fun emit_layer2_verified(
        attestation_hash: vector<u8>,
        oracle_nodes: vector<address>,
        zk_vk_hash: Option<vector<u8>>,
        kyc_status_at_mint: u8,
        timestamp_verified: u64,
    ) {
        event::emit(Layer2VerifiedEvent {
            attestation_hash,
            oracle_nodes,
            zk_vk_hash,
            kyc_status_at_mint,
            timestamp_verified,
        });
    }

    public fun emit_oracle_verification(
        batch_id: vector<u8>,
        verifier_type: u8,
        success: bool,
        block_timestamp: u64,
    ) {
        event::emit(OracleVerificationEvent {
            batch_id,
            verifier_type,
            success,
            block_timestamp,
        });
    }

    public fun mint_verified_reading(
        meter_id: ID,
        median_kwh: u64,
        timestamp: u64,
        attestation_hash: vector<u8>,
        ctx: &mut TxContext,
    ): VerifiedReading {
        VerifiedReading {
            id: object::new(ctx),
            meter_id,
            median_kwh,
            timestamp,
            attestation_hash,
        }
    }

    public fun new_energy_attestation(
        device_id: vector<u8>,
        kwh_delta: u64,
        timestamp: u64,
        secp256k1_sig: vector<u8>,
    ): EnergyAttestation {
        EnergyAttestation { device_id, kwh_delta, timestamp, secp256k1_sig }
    }
}
