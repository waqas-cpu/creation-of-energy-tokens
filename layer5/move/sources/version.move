/// GLOBAL-9 — Layer 5 package version for upgrade hooks.
module energy_settlement::version {
    public fun version(): u64 { VERSION }

    /// Declared in every L5 module dependency chain.
    const VERSION: u64 = 1;

    public fun assert_compatible(expected: u64) {
        assert!(expected == VERSION, 0);
    }
}
