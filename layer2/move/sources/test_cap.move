/// T-01 — TestOracleCap for local/test environments only.
module energy_oracle::test_cap {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;

    public struct TestOracleCap has key, store {
        id: UID,
    }

    public fun mint_test_cap(ctx: &mut TxContext): TestOracleCap {
        TestOracleCap { id: object::new(ctx) }
    }

    /// Must be called before mainnet — burns test capability.
    public fun burn_test_cap(cap: TestOracleCap) {
        let TestOracleCap { id } = cap;
        object::delete(id);
    }
}
