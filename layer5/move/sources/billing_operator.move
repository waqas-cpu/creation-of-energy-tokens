/// Gate 5.1.5 — operator override for billing period soft-fail.
module energy_settlement::billing_operator {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    use energy_grid::energy_token::AdminCap;

    public struct BillingOperatorCap has key, store {
        id: UID,
    }

    public fun create(_admin: &AdminCap, ctx: &mut TxContext): BillingOperatorCap {
        BillingOperatorCap { id: object::new(ctx) }
    }

    public fun transfer_cap(cap: BillingOperatorCap, recipient: address) {
        transfer::public_transfer(cap, recipient);
    }

    public fun assert_cap(_cap: &BillingOperatorCap) {}
}
