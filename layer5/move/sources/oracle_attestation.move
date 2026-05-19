/// Gate 5.2.2 — oracle signature verification at bridge time.
module energy_settlement::oracle_attestation {
    use std::bcs;
    use sui::ecdsa_k1;
    use sui::hash;
    use sui::object::ID;

    use energy_grid::energy_token::EnergyMeter;
    use energy_settlement::l5_errors;

    const SECP256K1: u8 = 0;

    public fun assert_valid_attestation(
        meter: &EnergyMeter,
        kwh: u64,
        timestamp: u64,
        sig: &vector<u8>,
    ) {
        assert!(vector::length(sig) == 64, l5_errors::invalid_oracle_sig());
        assert!(
            verify_oracle_sig(meter, kwh, timestamp, sig),
            l5_errors::invalid_oracle_sig(),
        );
    }

    public fun verify_oracle_sig(
        meter: &EnergyMeter,
        kwh: u64,
        timestamp: u64,
        sig: &vector<u8>,
    ): bool {
        let meter_id = energy_grid::energy_token::meter_id(meter);
        let digest = attestation_digest(&meter_id, kwh, timestamp);
        let pubkey = *energy_grid::energy_token::meter_pubkey(meter);
        ecdsa_k1::secp256k1_verify(sig, &pubkey, &digest, SECP256K1)
    }

    fun attestation_digest(meter_id: &ID, kwh: u64, timestamp: u64): vector<u8> {
        let mut msg = sui::object::id_to_bytes(meter_id);
        vector::append(&mut msg, bcs::to_bytes(&kwh));
        vector::append(&mut msg, bcs::to_bytes(&timestamp));
        hash::blake2b256(&msg)
    }

    #[test_only]
    public(package) fun sign_attestation_for_test(
        meter: &EnergyMeter,
        kwh: u64,
        timestamp: u64,
        sk: &vector<u8>,
    ): vector<u8> {
        let meter_id = energy_grid::energy_token::meter_id(meter);
        let digest = attestation_digest(&meter_id, kwh, timestamp);
        sui::ecdsa_k1::secp256k1_sign(sk, &digest, SECP256K1, false)
    }
}
