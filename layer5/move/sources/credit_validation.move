/// Module 5.1 — Credit Validation Engine (read-only, RULE-5.1-A..E).
module energy_settlement::credit_validation {
    use sui::coin::{Self, Coin};

    use energy_grid::energy_token::{Self, ENERGY, EnergyBatch};
    use energy_settlement::l5_errors;

    public struct InsufficientCredit has copy, drop {
        required: u64,
        available: u64,
    }

    /// Validates fungible balance and unredeemed batch (gates 5.1.2–5.1.3).
    public fun validate_credit(
        coin: &Coin<ENERGY>,
        batch: &EnergyBatch,
        kwh_claim: u64,
    ) {
        assert!(!energy_token::batch_redeemed(batch), l5_errors::already_redeemed());
        let required = checked_mul_kwh_scale(kwh_claim);
        let available = coin::value(coin);
        assert!(available >= required, l5_errors::insufficient_balance());
        assert!(energy_token::batch_kwh(batch) == kwh_claim, l5_errors::batch_kwh_mismatch());
    }

    public fun calculate_max_credit(coin: &Coin<ENERGY>, batch: &EnergyBatch): u64 {
        if (energy_token::batch_redeemed(batch)) {
            return 0
        };
        let coin_kwh = coin::value(coin) / energy_token::kwh_scale();
        let batch_kwh = energy_token::batch_kwh(batch);
        if (coin_kwh < batch_kwh) coin_kwh else batch_kwh
    }

    public fun checked_mul_kwh_scale(kwh: u64): u64 {
        let scale = energy_token::kwh_scale();
        let max_kwh = 18446744073709551615 / scale;
        assert!(kwh <= max_kwh, l5_errors::arithmetic_overflow());
        kwh * scale
    }
}
