module wormhole::publish_message {
    use sui::clock::Clock;
    use sui::coin::Coin;
    use sui::event;
    use sui::object::{Self, ID};
    use sui::sui::SUI;

    use wormhole::emitter::EmitterCap;
    use wormhole::state::{Self, State};

    public struct MessageTicket {
        sender: ID,
        sequence: u64,
        nonce: u32,
        payload: vector<u8>,
    }

    public struct WormholeMessage has copy, drop {
        sender: ID,
        sequence: u64,
        nonce: u32,
        payload_len: u64,
        consistency_level: u8,
        timestamp: u64,
    }

    public fun prepare_message(
        emitter_cap: &mut EmitterCap,
        nonce: u32,
        payload: vector<u8>,
    ): MessageTicket {
        let sequence = wormhole::emitter::use_sequence(emitter_cap);
        MessageTicket {
            sender: object::id(emitter_cap),
            sequence,
            nonce,
            payload,
        }
    }

    public fun publish_message(
        wormhole_state: &mut State,
        message_fee: Coin<SUI>,
        prepared_msg: MessageTicket,
        the_clock: &Clock,
    ): u64 {
        let latest_only = state::assert_latest_only(wormhole_state);
        state::deposit_fee(&latest_only, wormhole_state, sui::coin::into_balance(message_fee));

        let MessageTicket { sender, sequence, nonce, payload } = prepared_msg;
        let timestamp = sui::clock::timestamp_ms(the_clock) / 1000;
        let payload_len = vector::length(&payload);
        event::emit(WormholeMessage {
            sender,
            sequence,
            nonce,
            payload_len,
            consistency_level: 0,
            timestamp,
        });
        sequence
    }

    #[test_only]
    public fun destroy(prepared_msg: MessageTicket) {
        let MessageTicket { sender: _, sequence: _, nonce: _, payload: _ } = prepared_msg;
    }
}
