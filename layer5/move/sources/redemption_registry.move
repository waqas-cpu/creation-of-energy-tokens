/// Module 5.2 — Redemption idempotency registry (RULE-5.2-B).
module energy_settlement::redemption_registry {
    use sui::object::{Self, UID};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::TxContext;

    use energy_settlement::l5_errors;

    public struct RedemptionRegistry has key {
        id: UID,
        used_ids: Table<vector<u8>, bool>,
    }

    public fun create_registry(ctx: &mut TxContext): RedemptionRegistry {
        RedemptionRegistry {
            id: object::new(ctx),
            used_ids: table::new(ctx),
        }
    }

    public fun share_registry(reg: RedemptionRegistry) {
        transfer::share_object(reg);
    }

    public fun register_redemption_id(reg: &mut RedemptionRegistry, redemption_id: vector<u8>) {
        assert!(!table::contains(&reg.used_ids, redemption_id), l5_errors::duplicate_redemption_id());
        table::add(&mut reg.used_ids, redemption_id, true);
    }
}
