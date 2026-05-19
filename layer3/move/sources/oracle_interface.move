// Module: energy_grid::oracle_interface
// Layer: 3 — stub for L2 ReadingProof PTB composition (vertical decomp §9)
/*
AGENT_OWNER: ARCHITECT
MODULE: oracle_interface
NOTE: Production mint PTB step 1 calls energy_oracle::oracle::verify_reading (Layer 2).
*/
module energy_grid::oracle_interface {
    use sui::object::ID;

    public struct ReadingProof has copy, drop {
        attestation_hash: vector<u8>,
        median_kwh: u64,
        timestamp_ms: u64,
        meter_id: ID,
    }

    public fun new_reading_proof(
        attestation_hash: vector<u8>,
        median_kwh: u64,
        timestamp_ms: u64,
        meter_id: ID,
    ): ReadingProof {
        ReadingProof { attestation_hash, median_kwh, timestamp_ms, meter_id }
    }
}
