// Module: energy_grid::errors
// Layer: 3
// Gates verified: Appendix A (integration gates)
/// Layer 3 abort codes — integration gates Appendix A.
module energy_grid::errors {
    public fun zero_mint(): u64 { 0 }
    public fun invalid_attestation(): u64 { 1 }
    public fun stale_reading(): u64 { 2 }
    public fun uncertified_device(): u64 { 3 }
    public fun not_kyc_cleared(): u64 { 4 }
    public fun invalid_signature_format(): u64 { 5 }
    public fun already_redeemed(): u64 { 6 }
    public fun owner_mismatch(): u64 { 7 }
    public fun amount_mismatch(): u64 { 8 }
    public fun expired_batch(): u64 { 9 }
    public fun kyc_expired(): u64 { 10 }
    public fun timestamp_out_of_range(): u64 { 11 }
    public fun invalid_pubkey_length(): u64 { 12 }
    public fun already_certified(): u64 { 13 }
    public fun minting_paused(): u64 { 14 }
    public fun quota_exceeded(): u64 { 15 }
    public fun invalid_mint_auth(): u64 { 16 }
    public fun invalid_source(): u64 { 17 }
    public fun unauthorized(): u64 { 18 }
    public fun kyc_suspended(): u64 { 19 }
}
