/// Module 5.4 — Bridge & Reporting Adapter (RULE-5.4-C schema v1.0.0).
module energy_settlement::bridge_adapter {
    use sui::object::ID;
    use sui::tx_context::TxContext;

    use energy_settlement::version;

    const SCHEMA_V1: vector<u8> = b"v1.0.0";

    public struct RedemptionEvent has copy, drop {
        redemption_id: vector<u8>,
        batch_id: ID,
        kwh: u64,
        consumer: address,
        timestamp_ms: u64,
    }

    public struct BurnEvent has copy, drop {
        amount: u64,
        redemption_id: vector<u8>,
        consumer: address,
        timestamp_ms: u64,
    }

    public struct SettlementEventV1 has copy, drop {
        schema_version: vector<u8>,
        event_type: vector<u8>,
        redemption_id: vector<u8>,
        kwh: u64,
        consumer_addr: address,
        producer_addr: address,
        timestamp_ms: u64,
        block_height: u64,
    }

    public fun emit_redemption_event(
        redemption_id: vector<u8>,
        batch_id: ID,
        kwh: u64,
        consumer: address,
        ctx: &mut TxContext,
    ) {
        let ts = sui::tx_context::epoch_timestamp_ms(ctx);
        sui::event::emit(RedemptionEvent {
            redemption_id,
            batch_id,
            kwh,
            consumer,
            timestamp_ms: ts,
        });
        emit_settlement_event(
            b"REDEMPTION",
            redemption_id,
            kwh,
            consumer,
            consumer,
            ts,
            0,
        );
    }

    public fun emit_burn_event(
        amount: u64,
        redemption_id: vector<u8>,
        consumer: address,
        ctx: &mut TxContext,
    ) {
        let ts = sui::tx_context::epoch_timestamp_ms(ctx);
        sui::event::emit(BurnEvent { amount, redemption_id, consumer, timestamp_ms: ts });
        emit_settlement_event(
            b"BURN",
            redemption_id,
            amount / energy_grid::energy_token::kwh_scale(),
            consumer,
            consumer,
            ts,
            0,
        );
    }

    public fun emit_settlement_event(
        event_type: vector<u8>,
        redemption_id: vector<u8>,
        kwh: u64,
        consumer_addr: address,
        producer_addr: address,
        timestamp_ms: u64,
        block_height: u64,
    ) {
        sui::event::emit(SettlementEventV1 {
            schema_version: SCHEMA_V1,
            event_type,
            redemption_id,
            kwh,
            consumer_addr,
            producer_addr,
            timestamp_ms,
            block_height,
        });
    }

    public fun schema_version(): vector<u8> {
        SCHEMA_V1
    }

    public fun package_version(): u64 {
        version::version()
    }
}
