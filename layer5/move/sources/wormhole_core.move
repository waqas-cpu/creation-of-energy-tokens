/// Wormhole Core integration — prepare_message in-package, publish in same PTB (RULE-5.4-E).
module energy_settlement::wormhole_core {
    use std::bcs;
    use sui::clock::Clock;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::tx_context::TxContext;

    use wormhole::emitter::{Self, EmitterCap};
    use wormhole::publish_message::{Self, MessageTicket};
    use wormhole::state::State;

    use energy_grid::energy_token::EnergyBatch;
    use energy_settlement::l5_errors;

    const REC_PAYLOAD_MAGIC: vector<u8> = b"ENERGY_REC_V1";

    /// Build REC bridge payload and Wormhole MessageTicket (gate 5.2.7).
    public fun prepare_rec_message(
        emitter_cap: &mut EmitterCap,
        batch: &EnergyBatch,
        destination_chain: u16,
    ): MessageTicket {
        assert!(
            energy_grid::energy_token::batch_source(batch) <= energy_grid::energy_token::source_hydro(),
            l5_errors::ineligible_source(),
        );
        let kwh = energy_grid::energy_token::batch_kwh(batch);
        let source = energy_grid::energy_token::batch_source(batch);
        let mut payload = REC_PAYLOAD_MAGIC;
        vector::append(&mut payload, bcs::to_bytes(&kwh));
        vector::append(&mut payload, bcs::to_bytes(&source));
        vector::append(&mut payload, bcs::to_bytes(&destination_chain));
        publish_message::prepare_message(emitter_cap, 0, payload)
    }

    /// Publish via Wormhole core (call from same PTB after prepare_rec_message).
    public fun publish_rec_message(
        wormhole_state: &mut State,
        message_fee: Coin<SUI>,
        ticket: MessageTicket,
        clock: &Clock,
    ): u64 {
        publish_message::publish_message(wormhole_state, message_fee, ticket, clock)
    }

    public fun init_wormhole_state(message_fee: u64, ctx: &mut TxContext): State {
        wormhole::state::create_state(message_fee, ctx)
    }

    public fun share_wormhole_state(s: State) {
        wormhole::state::share_state(s);
    }

    public fun create_emitter_cap(wormhole_state: &State, ctx: &mut TxContext): EmitterCap {
        emitter::new(wormhole_state, ctx)
    }
}
