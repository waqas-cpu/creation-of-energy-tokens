/// Domain 2B — Cryptographic verification (G-L2-02).
module energy_oracle::crypto {
    use sui::ecdsa_k1;

    use energy_oracle::attestation;
    use energy_oracle::device_registry;
    use energy_oracle::device_registry::EnergyMeter;
    use energy_oracle::errors;
    use energy_oracle::types::{Self, CanonicalAttestation, CryptoProof};

    const SECP256K1: u8 = 0;

    public fun assert_low_s(sig: &vector<u8>) {
        assert!(vector::length(sig) == 65, errors::invalid_signature());
        let s_first = *vector::borrow(sig, 32);
        assert!(s_first < 128, errors::high_s_signature());
    }

    public fun verify_ecdsa(
        canonical: &CanonicalAttestation,
        meter: &EnergyMeter,
    ): bool {
        let payload = attestation::payload_hash(canonical);
        let pubkey = *device_registry::meter_pubkey(meter);
        let sig = types::canonical_sig(canonical);
        assert_low_s(sig);
        ecdsa_k1::secp256k1_verify(sig, &pubkey, &payload, SECP256K1)
    }

    public fun verify_and_prove(
        canonical: &CanonicalAttestation,
        meter: &EnergyMeter,
        zk_valid: bool,
    ): CryptoProof {
        let ecdsa_ok = verify_ecdsa(canonical, meter);
        assert!(ecdsa_ok, errors::invalid_signature());
        let hash = attestation::attestation_hash(canonical);
        types::new_crypto_proof(hash, true, zk_valid)
    }

    public fun assert_combined(proof: &CryptoProof, zk_required: bool) {
        assert!(types::proof_ecdsa_valid(proof), errors::invalid_signature());
        if (zk_required) {
            assert!(types::proof_zk_valid(proof), errors::zk_proof_invalid());
        };
        assert!(types::proof_combined_valid(proof), errors::invalid_signature());
    }
}
