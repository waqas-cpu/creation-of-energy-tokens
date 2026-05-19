// Module: energy_grid::compliance_registry
// Layer: 3
// Gates verified: 5.1, CR-01..CR-09
/*
AGENT_OWNER: AGENT_4 (Compliance Agent)
MODULE: compliance_registry
PROVIDES: ComplianceRegistry, assert_cleared
*/
module energy_grid::compliance_registry {
    use sui::object::{Self, UID};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use energy_grid::energy_token::AdminCap;
    use energy_grid::errors;

    public fun kyc_pending(): u8 { 0 }
    public fun kyc_cleared(): u8 { 1 }
    public fun kyc_suspended(): u8 { 2 }

    public struct KycRecord has copy, drop, store {
        status: u8,
        jurisdiction: u16,
        expiry: u64,
    }

    public struct ComplianceRegistry has key, store {
        id: UID,
        records: Table<address, KycRecord>,
    }

    public struct KycUpdated has copy, drop {
        addr: address,
        status: u8,
        expiry: u64,
    }

    public struct KycRemoved has copy, drop {
        addr: address,
    }

    public fun create_registry(ctx: &mut TxContext): ComplianceRegistry {
        ComplianceRegistry {
            id: object::new(ctx),
            records: table::new(ctx),
        }
    }

    public fun share_registry(reg: ComplianceRegistry) {
        transfer::share_object(reg);
    }

    public fun upsert_kyc_record(
        _admin: &AdminCap,
        reg: &mut ComplianceRegistry,
        addr: address,
        status: u8,
        jurisdiction: u16,
        expiry: u64,
    ) {
        let record = KycRecord { status, jurisdiction, expiry };
        if (table::contains(&reg.records, addr)) {
            *table::borrow_mut(&mut reg.records, addr) = record;
        } else {
            table::add(&mut reg.records, addr, record);
        };
        sui::event::emit(KycUpdated { addr, status, expiry });
    }

    public fun remove_kyc_record(
        _admin: &AdminCap,
        reg: &mut ComplianceRegistry,
        addr: address,
    ) {
        assert!(table::contains(&reg.records, addr), errors::not_kyc_cleared());
        table::remove(&mut reg.records, addr);
        sui::event::emit(KycRemoved { addr });
    }

    /// Gate 5.1.1 — consumer KYC before utility redemption.
    public fun assert_consumer(reg: &ComplianceRegistry, addr: address, ctx: &TxContext) {
        assert_cleared(reg, addr, ctx);
    }

    public fun jurisdiction_of(reg: &ComplianceRegistry, addr: address): u16 {
        assert!(table::contains(&reg.records, addr), errors::not_kyc_cleared());
        table::borrow(&reg.records, addr).jurisdiction
    }

    /// M5 / Gate 5.1 — read-only check before mint (CR-04).
    public fun assert_cleared(reg: &ComplianceRegistry, addr: address, ctx: &TxContext) {
        assert!(table::contains(&reg.records, addr), errors::not_kyc_cleared());
        let record = table::borrow(&reg.records, addr);
        assert!(record.status == kyc_cleared(), errors::not_kyc_cleared());
        assert!(record.status != kyc_suspended(), errors::kyc_suspended());
        let now = tx_context::epoch_timestamp_ms(ctx);
        assert!(record.expiry > now, errors::kyc_expired());
    }

    public fun new_kyc_record(status: u8, jurisdiction: u16, expiry: u64): KycRecord {
        KycRecord { status, jurisdiction, expiry }
    }
}
