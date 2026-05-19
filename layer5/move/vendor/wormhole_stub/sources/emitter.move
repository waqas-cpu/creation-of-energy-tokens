module wormhole::emitter {
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    public struct EmitterCap has key, store {
        id: UID,
        sequence: u64,
    }

    public fun new(_: &wormhole::state::State, ctx: &mut TxContext): EmitterCap {
        EmitterCap { id: object::new(ctx), sequence: 0 }
    }

    public fun use_sequence(cap: &mut EmitterCap): u64 {
        let seq = cap.sequence;
        cap.sequence = cap.sequence + 1;
        seq
    }

    #[test_only]
    public fun destroy_test_only(cap: EmitterCap) {
        let EmitterCap { id, sequence: _ } = cap;
        object::delete(id);
    }
}
