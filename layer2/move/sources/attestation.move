/// Domain 2A — Attestation ingestion (G-L2-01).
module energy_oracle::attestation {
    use sui::bcs;
    use sui::hash;
    use sui::table::{Self, Table};
    use sui::tx_context::TxContext;

    use energy_oracle::device_registry::{Self, DeviceRegistry, EnergyMeter};
    use energy_oracle::errors;
    use energy_oracle::types::{Self, CanonicalAttestation, EnergyAttestation};

    public struct ProcessedAttestationTable has key, store {
        id: sui::object::UID,
        processed: Table<vector<u8>, bool>,
    }

    public fun create_processed_table(ctx: &mut TxContext): ProcessedAttestationTable {
        ProcessedAttestationTable {
            id: sui::object::new(ctx),
            processed: table::new(ctx),
        }
    }

    public fun share_processed_table(table: ProcessedAttestationTable) {
        sui::transfer::share_object(table);
    }

    public fun validate_schema(att: &EnergyAttestation) {
        let device_id = types::att_device_id(att);
        assert!(vector::length(device_id) > 0, errors::malformed_attestation());
        assert!(
            vector::length(device_id) <= types::max_device_id_len(),
            errors::malformed_attestation(),
        );
        assert!(types::att_kwh_delta(att) > 0, errors::malformed_attestation());
        assert!(types::att_timestamp(att) > 0, errors::malformed_attestation());
        assert!(
            vector::length(types::att_sig(att)) == types::sig_len(),
            errors::malformed_attestation(),
        );
    }

    public fun assert_timestamp_fresh(att: &EnergyAttestation, now_ms: u64) {
        let ts = types::att_timestamp(att);
        assert!(ts <= now_ms + types::future_tolerance_ms(), errors::future_timestamp());
        let drift = if (now_ms > ts) {
            now_ms - ts
        } else {
            ts - now_ms
        };
        assert!(drift <= types::timestamp_drift_ms(), errors::stale_attestation());
    }

    public fun attestation_dedup_key(att: &EnergyAttestation): vector<u8> {
        let mut payload = *types::att_device_id(att);
        vector::append(&mut payload, bcs::to_bytes(&types::att_timestamp(att)));
        vector::append(&mut payload, bcs::to_bytes(&types::att_kwh_delta(att)));
        hash::blake2b256(&payload)
    }

    public fun assert_not_duplicate(
        table: &ProcessedAttestationTable,
        key: &vector<u8>,
    ) {
        assert!(!table::contains(&table.processed, *key), errors::duplicate_attestation());
    }

    public fun mark_processed(table: &mut ProcessedAttestationTable, key: vector<u8>) {
        table::add(&mut table.processed, key, true);
    }

    public fun ingest(
        att: EnergyAttestation,
        registry: &DeviceRegistry,
        processed: &mut ProcessedAttestationTable,
        meter: &EnergyMeter,
        now_ms: u64,
        source_type: u8,
    ): CanonicalAttestation {
        validate_schema(&att);
        assert_timestamp_fresh(&att, now_ms);
        device_registry::assert_device_registered(registry, types::att_device_id(&att));
        assert!(
            *device_registry::meter_device_id(meter) == *types::att_device_id(&att),
            errors::unknown_device(),
        );
        let key = attestation_dedup_key(&att);
        assert_not_duplicate(processed, &key);
        mark_processed(processed, key);
        types::new_canonical(
            *types::att_device_id(&att),
            types::att_kwh_delta(&att),
            types::att_timestamp(&att),
            *types::att_sig(&att),
            source_type,
        )
    }

    public fun payload_hash(canonical: &CanonicalAttestation): vector<u8> {
        let mut payload = *types::canonical_device_id(canonical);
        vector::append(&mut payload, bcs::to_bytes(&types::canonical_kwh(canonical)));
        vector::append(&mut payload, bcs::to_bytes(&types::canonical_timestamp_ms(canonical)));
        hash::blake2b256(&payload)
    }

    public fun attestation_hash(canonical: &CanonicalAttestation): vector<u8> {
        payload_hash(canonical)
    }
}
