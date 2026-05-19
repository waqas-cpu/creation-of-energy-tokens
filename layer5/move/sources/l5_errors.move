/// Layer 5 abort codes — integration gates Appendix §9 (documented hex → u64).
module energy_settlement::l5_errors {
    public fun insufficient_balance(): u64 { 501 }
    public fun already_redeemed(): u64 { 502 }
    public fun meter_not_certified(): u64 { 503 }
    public fun ineligible_source(): u64 { 504 }
    public fun unregistered_destination(): u64 { 505 }
    public fun stale_price(): u64 { 506 }
    public fun slippage_exceeded(): u64 { 507 }
    public fun insufficient_liquidity(): u64 { 508 }
    public fun jurisdiction_mismatch(): u64 { 509 }
    public fun duplicate_redemption_id(): u64 { 510 }
    public fun arithmetic_overflow(): u64 { 511 }
    public fun unauthorized(): u64 { 512 }
    public fun bridge_not_approved(): u64 { 513 }
    public fun batch_kwh_mismatch(): u64 { 514 }
    public fun invalid_oracle_sig(): u64 { 515 }
    public fun billing_period_requires_override(): u64 { 516 }
    public fun vaa_sequence_stale(): u64 { 517 }
}
