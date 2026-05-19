// Module: energy_grid::batch_receipt
// Layer: 3
// Gates verified: O2.3, 3.3, BR-01..BR-08
module energy_grid::batch_receipt {
    use sui::object::{Self, ID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    use energy_grid::energy_token::{Self, EnergyBatch, EnergyMeter};
    use energy_grid::errors;

    public struct BatchIssued has copy, drop {
        batch_id: ID,
        producer: address,
        kwh: u64,
        meter_id: ID,
    }

    public struct BatchRedeemed has copy, drop {
        batch_id: ID,
    }

    public(package) fun issue_batch(
        producer: address,
        kwh: u64,
        source: u8,
        meter: &EnergyMeter,
        oracle_sig: vector<u8>,
        timestamp: u64,
        ctx: &mut TxContext,
    ): EnergyBatch {
        assert!(source <= energy_token::max_source(), errors::invalid_source());
        let batch = energy_token::new_batch(
            producer,
            kwh,
            source,
            timestamp,
            energy_token::meter_id(meter),
            oracle_sig,
            ctx,
        );
        let batch_id = object::id(&batch);
        sui::event::emit(BatchIssued {
            batch_id,
            producer,
            kwh,
            meter_id: energy_token::meter_id(meter),
        });
        batch
    }

    public fun transfer_batch_to_producer(batch: EnergyBatch, producer: address) {
        transfer::public_transfer(batch, producer);
    }

    public fun mark_redeemed(batch: &mut EnergyBatch) {
        assert!(!energy_token::batch_redeemed(batch), errors::already_redeemed());
        energy_token::set_batch_redeemed(batch);
        sui::event::emit(BatchRedeemed { batch_id: object::id(batch) });
    }

    public fun assert_redeemable(batch: &EnergyBatch, coin_value: u64) {
        assert!(!energy_token::batch_redeemed(batch), errors::already_redeemed());
        assert!(
            coin_value == energy_token::batch_kwh(batch) * energy_token::kwh_scale(),
            errors::amount_mismatch(),
        );
    }

    public fun is_redeemed(batch: &EnergyBatch): bool {
        energy_token::batch_redeemed(batch)
    }

    public fun get_kwh(batch: &EnergyBatch): u64 {
        energy_token::batch_kwh(batch)
    }

    public fun get_source(batch: &EnergyBatch): u8 {
        energy_token::batch_source(batch)
    }
}
