// Module: energy_grid::energy_token
// Layer: 3
// Gates verified: O2.1, O2.2, O2.3, ET-01..ET-08
/*
AGENT_OWNER: AGENT_6 (Tokenonomist)
MODULE: energy_token
DEPENDS_ON: sui::coin
PROVIDES: ENERGY, EnergyMeter, EnergyBatch, AdminCap
*/
module energy_grid::energy_token {
    use std::option;
    use sui::coin::{Self, TreasuryCap};
    use energy_grid::errors;
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    /// Witness — drop only (Gate O2.1a).
    public struct ENERGY has drop {}

    public struct AdminCap has key, store {
        id: UID,
    }

    /// Shared per device — key only, no store (Gate O2.2a).
    public struct EnergyMeter has key {
        id: UID,
        device_pubkey: vector<u8>,
        total_kwh: u64,
        last_reading_ts: u64,
        is_certified: bool,
        producer_addr: address,
    }

    /// Audit NFT — key + store (Gate O2.3).
    public struct EnergyBatch has key, store {
        id: UID,
        producer: address,
        kwh: u64,
        source: u8,
        timestamp: u64,
        meter_id: ID,
        oracle_sig: vector<u8>,
        redeemed: bool,
    }

    public fun kwh_scale(): u64 { 1_000_000 }
    public fun source_solar(): u8 { 0 }
    public fun source_wind(): u8 { 1 }
    public fun source_hydro(): u8 { 2 }
    public fun source_grid(): u8 { 3 }
    public fun max_source(): u8 { 3 }
    public fun timestamp_tolerance_ms(): u64 { 300_000 }

    public fun meter_id(m: &EnergyMeter): ID { object::id(m) }
    public fun meter_pubkey(m: &EnergyMeter): &vector<u8> { &m.device_pubkey }
    public fun meter_total_kwh(m: &EnergyMeter): u64 { m.total_kwh }
    public fun meter_last_ts(m: &EnergyMeter): u64 { m.last_reading_ts }
    public fun meter_is_certified(m: &EnergyMeter): bool { m.is_certified }
    public fun meter_producer(m: &EnergyMeter): address { m.producer_addr }

    public fun batch_kwh(b: &EnergyBatch): u64 { b.kwh }
    public fun batch_redeemed(b: &EnergyBatch): bool { b.redeemed }
    public fun batch_producer(b: &EnergyBatch): address { b.producer }
    public fun batch_meter_id(b: &EnergyBatch): ID { b.meter_id }
    public fun batch_source(b: &EnergyBatch): u8 { b.source }
    public fun batch_timestamp(b: &EnergyBatch): u64 { b.timestamp }
    public fun batch_oracle_sig(b: &EnergyBatch): &vector<u8> { &b.oracle_sig }

    public(package) fun share_meter(meter: EnergyMeter) {
        transfer::share_object(meter);
    }

    public(package) fun new_meter(
        device_pubkey: vector<u8>,
        producer_addr: address,
        ctx: &mut TxContext,
    ): EnergyMeter {
        EnergyMeter {
            id: object::new(ctx),
            device_pubkey,
            total_kwh: 0,
            last_reading_ts: 0,
            is_certified: false,
            producer_addr,
        }
    }

    public(package) fun certify_meter(meter: &mut EnergyMeter) {
        meter.is_certified = true;
    }

    public(package) fun apply_meter_reading(meter: &mut EnergyMeter, kwh: u64, timestamp: u64) {
        meter.total_kwh = meter.total_kwh + kwh;
        meter.last_reading_ts = timestamp;
    }

    public(package) fun new_batch(
        producer: address,
        kwh: u64,
        source: u8,
        timestamp: u64,
        meter_id: ID,
        oracle_sig: vector<u8>,
        ctx: &mut TxContext,
    ): EnergyBatch {
        EnergyBatch {
            id: object::new(ctx),
            producer,
            kwh,
            source,
            timestamp,
            meter_id,
            oracle_sig,
            redeemed: false,
        }
    }

    public(package) fun set_batch_redeemed(batch: &mut EnergyBatch) {
        batch.redeemed = true;
    }

    /// Gate 5.2.8 — consume batch for carbon bridge (delete on Sui).
    public fun consume_batch_for_bridge(
        batch: EnergyBatch,
    ): (address, u64, u8, ID, vector<u8>) {
        assert!(!batch.redeemed, errors::already_redeemed());
        let EnergyBatch {
            id,
            producer,
            kwh,
            source,
            timestamp: _,
            meter_id,
            oracle_sig,
            redeemed: _,
        } = batch;
        object::delete(id);
        (producer, kwh, source, meter_id, oracle_sig)
    }

    /// Witness consumed exactly once in init (Gate O2.1b).
    fun init(ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            ENERGY {},
            6,
            b"ENERGY",
            b"Energy Token",
            b"Tokenised kWh on Sui",
            option::none(),
            ctx,
        );
        transfer::public_freeze_object(metadata);
        let admin = AdminCap { id: object::new(ctx) };
        transfer::public_transfer(admin, ctx.sender());
        transfer::public_transfer(treasury_cap, ctx.sender());
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext): (TreasuryCap<ENERGY>, AdminCap) {
        let treasury_cap = coin::create_treasury_cap_for_testing<ENERGY>(ctx);
        let admin = AdminCap { id: object::new(ctx) };
        (treasury_cap, admin)
    }

    #[test_only]
    public fun destroy_admin_for_testing(cap: AdminCap) {
        let AdminCap { id } = cap;
        object::delete(id);
    }

    #[test_only]
    public fun destroy_treasury_for_testing(cap: TreasuryCap<ENERGY>) {
        transfer::public_transfer(cap, @0x0);
    }
}
