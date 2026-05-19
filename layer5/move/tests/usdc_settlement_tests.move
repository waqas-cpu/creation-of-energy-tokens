#[test_only]
module energy_settlement::usdc_settlement_tests {
    use energy_settlement::usdc_settlement;

    #[test]
    fun test_fee_bps_cap() {
        usdc_settlement::assert_fee_bps(500);
    }

    #[test]
    fun test_pyth_to_u128() {
        let v = usdc_settlement::pyth_to_u128(1_000_000, 6);
        assert!(v == 1, 0);
    }

    #[test]
    fun test_price_confidence_ok() {
        usdc_settlement::assert_price_confidence(100);
    }

    #[test]
    #[expected_failure(abort_code = 506)]
    fun test_price_confidence_too_wide() {
        usdc_settlement::assert_price_confidence(501);
    }
}
