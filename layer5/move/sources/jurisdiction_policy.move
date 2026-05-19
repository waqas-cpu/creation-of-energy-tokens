/// GLOBAL-8 — pluggable cross-border jurisdiction rules.
module energy_settlement::jurisdiction_policy {
    use sui::object::{Self, UID};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::TxContext;

    use energy_grid::energy_token::AdminCap;
    use energy_settlement::l5_errors;
    use energy_settlement::version;

    public struct JurisdictionPolicy has key {
        id: UID,
        version: u64,
        allowed_pairs: Table<u32, bool>,
    }

    public fun create(ctx: &mut TxContext): JurisdictionPolicy {
        JurisdictionPolicy {
            id: object::new(ctx),
            version: version::version(),
            allowed_pairs: table::new(ctx),
        }
    }

    public fun share(policy: JurisdictionPolicy) {
        transfer::share_object(policy);
    }

    fun pair_key(from: u16, to: u16): u32 {
        ((from as u32) << 16) | (to as u32)
    }

    public fun allow_cross_border(
        _admin: &AdminCap,
        policy: &mut JurisdictionPolicy,
        from: u16,
        to: u16,
    ) {
        version::assert_compatible(policy.version);
        let key = pair_key(from, to);
        if (!table::contains(&policy.allowed_pairs, key)) {
            table::add(&mut policy.allowed_pairs, key, true);
        };
    }

    public fun is_allowed(policy: &JurisdictionPolicy, producer_j: u16, consumer_j: u16): bool {
        if (producer_j == consumer_j) return true;
        table::contains(&policy.allowed_pairs, pair_key(producer_j, consumer_j))
    }

    public fun assert_allowed(policy: &JurisdictionPolicy, producer_j: u16, consumer_j: u16) {
        assert!(is_allowed(policy, producer_j, consumer_j), l5_errors::jurisdiction_mismatch());
    }
}
