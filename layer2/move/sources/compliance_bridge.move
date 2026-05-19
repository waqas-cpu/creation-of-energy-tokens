/// Domain 2E — KYC / compliance bridge (G-L2-05).
module energy_oracle::compliance_bridge {
    use sui::object::{Self, UID};
    use sui::table::{Self, Table};
    use sui::tx_context::TxContext;

    use energy_oracle::errors;
    use energy_oracle::types;

    public struct KycRecord has store, copy, drop {
        status: u8,
        jurisdiction: u16,
        expiry: u64,
        bridge_sequence: u64,
    }

    public fun new_kyc_record(
        status: u8,
        jurisdiction: u16,
        expiry: u64,
        bridge_sequence: u64,
    ): KycRecord {
        KycRecord { status, jurisdiction, expiry, bridge_sequence }
    }

    public struct ComplianceRegistry has key, store {
        id: UID,
        records: Table<address, KycRecord>,
        kyc_oracle_pubkey: vector<u8>,
    }

    public struct JurisdictionBlacklist has key, store {
        id: UID,
        blocked: Table<u16, bool>,
    }

    public fun create_registry(
        kyc_oracle_pubkey: vector<u8>,
        ctx: &mut TxContext,
    ): ComplianceRegistry {
        ComplianceRegistry {
            id: object::new(ctx),
            records: table::new(ctx),
            kyc_oracle_pubkey,
        }
    }

    public fun create_blacklist(ctx: &mut TxContext): JurisdictionBlacklist {
        JurisdictionBlacklist {
            id: object::new(ctx),
            blocked: table::new(ctx),
        }
    }

    public fun upsert_kyc(
        reg: &mut ComplianceRegistry,
        addr: address,
        record: KycRecord,
    ) {
        if (table::contains(&reg.records, addr)) {
            let existing = table::borrow(&reg.records, addr);
            assert!(
                record.bridge_sequence > existing.bridge_sequence,
                errors::stale_kyc_bridge(),
            );
            *table::borrow_mut(&mut reg.records, addr) = record;
        } else {
            table::add(&mut reg.records, addr, record);
        }
    }

    public fun block_jurisdiction(blacklist: &mut JurisdictionBlacklist, code: u16) {
        if (!table::contains(&blacklist.blocked, code)) {
            table::add(&mut blacklist.blocked, code, true);
        };
    }

    public fun is_jurisdiction_blocked(blacklist: &JurisdictionBlacklist, code: u16): bool {
        table::contains(&blacklist.blocked, code) &&
            *table::borrow(&blacklist.blocked, code)
    }

    public fun assert_kyc_status(record: &KycRecord) {
        if (record.status == types::kyc_pending()) {
            assert!(false, errors::pending_kyc());
        } else if (record.status == types::kyc_cleared()) {
            // pass
        } else if (record.status == types::kyc_suspended()) {
            assert!(false, errors::suspended_kyc());
        } else if (record.status == types::kyc_revoked()) {
            assert!(false, errors::revoked_kyc());
        } else {
            assert!(false, errors::unknown_kyc_status());
        };
    }

    public fun assert_producer(
        reg: &ComplianceRegistry,
        blacklist: &JurisdictionBlacklist,
        producer: address,
        now_ms: u64,
    ): u8 {
        assert!(table::contains(&reg.records, producer), errors::not_kyc_cleared());
        let record = table::borrow(&reg.records, producer);
        assert_kyc_status(record);
        assert!(record.expiry > now_ms, errors::kyc_expired());
        assert!(
            !is_jurisdiction_blocked(blacklist, record.jurisdiction),
            errors::jurisdiction_blocked(),
        );
        record.status
    }

    public fun share_registry(reg: ComplianceRegistry) {
        sui::transfer::share_object(reg);
    }

    public fun share_blacklist(blacklist: JurisdictionBlacklist) {
        sui::transfer::share_object(blacklist);
    }
}
