module wormhole::state {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    public struct State has key {
        id: UID,
        message_fee: u64,
        fee_pool: sui::balance::Balance<sui::sui::SUI>,
    }

    public struct LatestOnly has drop {}

    public fun create_state(message_fee: u64, ctx: &mut TxContext): State {
        State { id: object::new(ctx), message_fee, fee_pool: sui::balance::zero() }
    }

    public fun share_state(s: State) {
        transfer::share_object(s);
    }

    public fun assert_latest_only(_: &mut State): LatestOnly {
        LatestOnly {}
    }

    public fun deposit_fee(_: &LatestOnly, s: &mut State, balance: sui::balance::Balance<sui::sui::SUI>) {
        sui::balance::join(&mut s.fee_pool, balance);
    }

    #[test_only]
    public fun message_fee(s: &State): u64 {
        s.message_fee
    }
}
