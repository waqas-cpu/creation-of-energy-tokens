#[test_only]
module energy_settlement::invariant_tests {
    use sui::test_scenario::{Self as ts};
    use sui::transfer;

    use energy_grid::energy_token::{Self, AdminCap};
    use energy_settlement::credit_validation;
    use energy_settlement::jurisdiction_policy;
    use energy_settlement::usdc_settlement;
    use energy_settlement::version;

    const ADMIN: address = @0xAD;

    #[test]
    fun test_package_version() {
        assert!(version::version() == 1, 0);
    }

    #[test]
    fun test_pyth_normalization() {
        let v = usdc_settlement::pyth_to_u128(123456789, 8);
        assert!(v == 1, 0);
    }

    #[test]
    fun test_jurisdiction_policy_same_region() {
        let mut scenario = ts::begin(ADMIN);
        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let (treasury_cap, admin) = energy_token::init_for_testing(ctx);
            energy_grid::treasury_guard::wrap_and_share(&admin, treasury_cap, ctx);
            let policy = jurisdiction_policy::create(ctx);
            assert!(jurisdiction_policy::is_allowed(&policy, 840, 840), 0);
            jurisdiction_policy::share(policy);
            transfer::public_transfer(admin, ADMIN);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_checked_mul_invariant() {
        let v = credit_validation::checked_mul_kwh_scale(1);
        assert!(v == 1_000_000, 0);
    }
}
