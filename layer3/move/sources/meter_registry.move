// Module: energy_grid::meter_registry
// Layer: 3
// Gates verified: O2.2, EM-01..EM-08
module energy_grid::meter_registry {
    use sui::object::{Self, ID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    use energy_grid::energy_token::{Self, AdminCap, EnergyMeter};
    use energy_grid::errors;

    public struct MeterRegistered has copy, drop {
        meter_id: ID,
        producer: address,
    }

    public struct MeterCertified has copy, drop {
        meter_id: ID,
    }

    public fun register_device(
        _admin: &AdminCap,
        device_pubkey: vector<u8>,
        producer_addr: address,
        ctx: &mut TxContext,
    ): ID {
        let len = vector::length(&device_pubkey);
        assert!(len == 33 || len == 65, errors::invalid_pubkey_length());
        let meter = energy_token::new_meter(device_pubkey, producer_addr, ctx);
        let meter_id = object::id(&meter);
        sui::event::emit(MeterRegistered { meter_id, producer: producer_addr });
        energy_token::share_meter(meter);
        meter_id
    }

    public fun certify_device(_admin: &AdminCap, meter: &mut EnergyMeter) {
        assert!(!energy_token::meter_is_certified(meter), errors::already_certified());
        energy_token::certify_meter(meter);
        sui::event::emit(MeterCertified { meter_id: object::id(meter) });
    }

    public fun get_total_kwh(meter: &EnergyMeter): u64 {
        energy_token::meter_total_kwh(meter)
    }

    public fun is_certified(meter: &EnergyMeter): bool {
        energy_token::meter_is_certified(meter)
    }

    public(package) fun update_meter_reading(
        meter: &mut EnergyMeter,
        kwh: u64,
        timestamp: u64,
    ) {
        energy_token::apply_meter_reading(meter, kwh, timestamp);
    }
}
