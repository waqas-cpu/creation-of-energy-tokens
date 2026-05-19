/// Slice 5.2 — GridSettlementLedger (vertical decomp §2.2).
module energy_settlement::grid_ledger {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use energy_settlement::l5_errors;

    public struct GridOperatorCap has key, store {
        id: UID,
    }

    public struct GridSettlementLedger has key {
        id: UID,
        zone_id: u16,
        total_redeemed_kwh: u64,
        total_burned_tokens: u64,
        last_settlement_ts: u64,
    }

    public struct BillingSettlementEvent has copy, drop {
        consumer: address,
        zone_id: u16,
        kwh: u64,
        credit_note_id: sui::object::ID,
        usdc_equiv: u64,
    }

    public fun create_cap(ctx: &mut TxContext): GridOperatorCap {
        GridOperatorCap { id: object::new(ctx) }
    }

    public fun create_ledger(zone_id: u16, ctx: &mut TxContext): GridSettlementLedger {
        GridSettlementLedger {
            id: object::new(ctx),
            zone_id,
            total_redeemed_kwh: 0,
            total_burned_tokens: 0,
            last_settlement_ts: 0,
        }
    }

    public fun share_ledger(ledger: GridSettlementLedger) {
        transfer::share_object(ledger);
    }

    public fun record_settlement(
        _cap: &GridOperatorCap,
        ledger: &mut GridSettlementLedger,
        consumer: address,
        kwh: u64,
        burn_amount: u64,
        credit_note_id: sui::object::ID,
        usdc_equiv: u64,
        ctx: &mut TxContext,
    ) {
        let new_kwh = ledger.total_redeemed_kwh + kwh;
        assert!(new_kwh >= ledger.total_redeemed_kwh, l5_errors::arithmetic_overflow());
        let new_burn = ledger.total_burned_tokens + burn_amount;
        assert!(new_burn >= ledger.total_burned_tokens, l5_errors::arithmetic_overflow());
        ledger.total_redeemed_kwh = new_kwh;
        ledger.total_burned_tokens = new_burn;
        ledger.last_settlement_ts = tx_context::epoch_timestamp_ms(ctx);
        sui::event::emit(BillingSettlementEvent {
            consumer,
            zone_id: ledger.zone_id,
            kwh,
            credit_note_id,
            usdc_equiv,
        });
    }
}
