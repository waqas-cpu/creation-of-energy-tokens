/// Gate 5.2 — carbon::bridge (gates 5.2.1–5.2.9).

module energy_settlement::carbon_bridge {

    use sui::event;

    use sui::object::{Self, UID};

    use sui::table::{Self, Table};

    use sui::transfer;

    use sui::tx_context::{Self, TxContext};



    use energy_grid::compliance_registry::{Self, ComplianceRegistry};

    use energy_grid::energy_token::{Self, EnergyBatch, EnergyMeter};

    use energy_settlement::l5_errors;

    use energy_settlement::oracle_attestation;

    use energy_settlement::version;

    use energy_settlement::wormhole_core;

    use sui::clock::Clock;

    use sui::coin::{Self, Coin};

    use sui::sui::SUI;

    use wormhole::emitter::EmitterCap;

    use wormhole::state::State as WormholeCoreState;



    public struct BridgeWhitelist has key {

        id: UID,

        chains: Table<u16, bool>,

        last_vaa_sequence: u64,

    }



    public struct WormholeState has key {

        id: UID,

        nonce: u64,

    }



    public struct RECBridgeInitiated has copy, drop {

        producer: address,

        kwh: u64,

        source: u8,

        meter_id: sui::object::ID,

        destination_chain: u16,

        timestamp: u64,

        oracle_sig_len: u64,

    }



    public struct PublishMessage has copy, drop {

        nonce: u64,

        payload_len: u64,

        consistency_level: u8,

        vaa_sequence: u64,

    }



    public struct VAASequenceStale has copy, drop {

        incoming: u64,

        last_recorded: u64,

    }



    public struct BridgeTicket has key, store {

        id: UID,

        destination_chain: u16,

        vaa_sequence: u64,

    }



    public fun create_whitelist(ctx: &mut TxContext): BridgeWhitelist {

        BridgeWhitelist {

            id: object::new(ctx),

            chains: table::new(ctx),

            last_vaa_sequence: 0,

        }

    }



    public fun share_whitelist(w: BridgeWhitelist) {

        transfer::share_object(w);

    }



    public fun whitelist_chain(w: &mut BridgeWhitelist, chain_id: u16) {

        if (!table::contains(&w.chains, chain_id)) {

            table::add(&mut w.chains, chain_id, true);

        };

    }



    public fun init_wormhole(ctx: &mut TxContext): WormholeState {

        WormholeState { id: object::new(ctx), nonce: 0 }

    }



    public fun share_wormhole(s: WormholeState) {

        transfer::share_object(s);

    }



    /// Consumes batch by value; verifies oracle_sig (gate 5.2.2) before delete.

    public fun bridge_rec(

        batch: EnergyBatch,

        meter: &EnergyMeter,

        wormhole: &mut WormholeState,

        whitelist: &mut BridgeWhitelist,

        compliance: &ComplianceRegistry,

        destination_chain: u16,

        ctx: &mut TxContext,

    ): BridgeTicket {

        let _v = version::version();

        assert!(!energy_token::batch_redeemed(&batch), l5_errors::already_redeemed());

        assert!(energy_token::batch_source(&batch) <= energy_token::source_hydro(), l5_errors::ineligible_source());

        compliance_registry::assert_cleared(compliance, energy_token::batch_producer(&batch), ctx);

        assert!(table::contains(&whitelist.chains, destination_chain), l5_errors::unregistered_destination());



        let kwh = energy_token::batch_kwh(&batch);

        let reading_ts = energy_token::batch_timestamp(&batch);

        let sig = energy_token::batch_oracle_sig(&batch);

        oracle_attestation::assert_valid_attestation(meter, kwh, reading_ts, sig);



        let (producer, kwh_out, source, meter_id, oracle_sig) =

            energy_token::consume_batch_for_bridge(batch);



        let now = tx_context::epoch_timestamp_ms(ctx);

        let incoming_seq = wormhole.nonce + 1;

        record_vaa_sequence(whitelist, incoming_seq);



        event::emit(RECBridgeInitiated {

            producer,

            kwh: kwh_out,

            source,

            meter_id,

            destination_chain,

            timestamp: now,

            oracle_sig_len: vector::length(&oracle_sig),

        });



        wormhole.nonce = incoming_seq;

        event::emit(PublishMessage {

            nonce: 0,

            payload_len: kwh_out,

            consistency_level: 1,

            vaa_sequence: whitelist.last_vaa_sequence,

        });



        BridgeTicket {

            id: object::new(ctx),

            destination_chain,

            vaa_sequence: whitelist.last_vaa_sequence,

        }

    }



    /// Production path — Wormhole `prepare_message` + `publish_message` in same PTB (gates 5.2.7, 5.2.9).

    public fun bridge_rec_core(

        batch: EnergyBatch,

        meter: &EnergyMeter,

        emitter_cap: &mut EmitterCap,

        wormhole_state: &mut WormholeCoreState,

        message_fee: Coin<SUI>,

        whitelist: &mut BridgeWhitelist,

        compliance: &ComplianceRegistry,

        destination_chain: u16,

        clock: &Clock,

        ctx: &mut TxContext,

    ): BridgeTicket {

        let _v = version::version();

        assert!(!energy_token::batch_redeemed(&batch), l5_errors::already_redeemed());

        assert!(energy_token::batch_source(&batch) <= energy_token::source_hydro(), l5_errors::ineligible_source());

        compliance_registry::assert_cleared(compliance, energy_token::batch_producer(&batch), ctx);

        assert!(table::contains(&whitelist.chains, destination_chain), l5_errors::unregistered_destination());



        let kwh = energy_token::batch_kwh(&batch);

        let reading_ts = energy_token::batch_timestamp(&batch);

        let sig = energy_token::batch_oracle_sig(&batch);

        oracle_attestation::assert_valid_attestation(meter, kwh, reading_ts, sig);



        let ticket = wormhole_core::prepare_rec_message(emitter_cap, &batch, destination_chain);

        let wormhole_sequence = wormhole_core::publish_rec_message(

            wormhole_state,

            message_fee,

            ticket,

            clock,

        );



        let (producer, kwh_out, source, meter_id, oracle_sig) =

            energy_token::consume_batch_for_bridge(batch);



        let now = tx_context::epoch_timestamp_ms(ctx);

        record_vaa_sequence(whitelist, wormhole_sequence);



        event::emit(RECBridgeInitiated {

            producer,

            kwh: kwh_out,

            source,

            meter_id,

            destination_chain,

            timestamp: now,

            oracle_sig_len: vector::length(&oracle_sig),

        });



        event::emit(PublishMessage {

            nonce: 0,

            payload_len: kwh_out,

            consistency_level: 0,

            vaa_sequence: wormhole_sequence,

        });



        BridgeTicket {

            id: object::new(ctx),

            destination_chain,

            vaa_sequence: wormhole_sequence,

        }

    }



    /// Gate 5.2.5 — soft-fail on stale VAA sequence; hard-continue after emit.

    fun record_vaa_sequence(whitelist: &mut BridgeWhitelist, incoming: u64) {

        if (incoming <= whitelist.last_vaa_sequence) {

            event::emit(VAASequenceStale {

                incoming,

                last_recorded: whitelist.last_vaa_sequence,

            });

        };

        if (incoming > whitelist.last_vaa_sequence) {

            whitelist.last_vaa_sequence = incoming;

        };

    }



    public fun verify_rec_eligible(batch: &EnergyBatch): bool {

        !energy_token::batch_redeemed(batch)

            && energy_token::batch_source(batch) <= energy_token::source_hydro()

    }



    #[test_only]

    public fun bridge_rec_skip_oracle(

        batch: EnergyBatch,

        wormhole: &mut WormholeState,

        whitelist: &mut BridgeWhitelist,

        compliance: &ComplianceRegistry,

        destination_chain: u16,

        ctx: &mut TxContext,

    ): BridgeTicket {

        assert!(!energy_token::batch_redeemed(&batch), l5_errors::already_redeemed());

        assert!(energy_token::batch_source(&batch) <= energy_token::source_hydro(), l5_errors::ineligible_source());

        compliance_registry::assert_cleared(compliance, energy_token::batch_producer(&batch), ctx);

        assert!(table::contains(&whitelist.chains, destination_chain), l5_errors::unregistered_destination());

        let (producer, kwh, source, meter_id, oracle_sig) = energy_token::consume_batch_for_bridge(batch);

        let now = tx_context::epoch_timestamp_ms(ctx);

        let incoming_seq = wormhole.nonce + 1;

        record_vaa_sequence(whitelist, incoming_seq);

        event::emit(RECBridgeInitiated {

            producer,

            kwh,

            source,

            meter_id,

            destination_chain,

            timestamp: now,

            oracle_sig_len: vector::length(&oracle_sig),

        });

        wormhole.nonce = incoming_seq;

        event::emit(PublishMessage {

            nonce: 0,

            payload_len: kwh,

            consistency_level: 1,

            vaa_sequence: whitelist.last_vaa_sequence,

        });

        BridgeTicket {

            id: object::new(ctx),

            destination_chain,

            vaa_sequence: whitelist.last_vaa_sequence,

        }

    }

}


