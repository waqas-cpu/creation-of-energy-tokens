/// On-chain device and meter registry (G-L2-01 R1.3, A-02).
module energy_oracle::device_registry {
    use sui::object::{Self, ID, UID};
    use sui::table::{Self, Table};
    use sui::tx_context::TxContext;

    use energy_oracle::errors;

    const DEVICE_ACTIVE: u8 = 1;

    public struct DeviceRegistry has key, store {
        id: UID,
        devices: Table<vector<u8>, DeviceEntry>,
    }

    public struct DeviceEntry has store {
        meter_id: ID,
        status: u8,
        expiry_ms: u64,
    }

    public struct EnergyMeter has key, store {
        id: UID,
        device_id: vector<u8>,
        device_pubkey: vector<u8>,
        total_kwh: u64,
        last_reading_ts: u64,
        is_certified: bool,
        producer_addr: address,
    }

    public fun create_registry(ctx: &mut TxContext): DeviceRegistry {
        DeviceRegistry {
            id: object::new(ctx),
            devices: table::new(ctx),
        }
    }

    public fun register_device(
        registry: &mut DeviceRegistry,
        device_id: vector<u8>,
        meter_id: ID,
        expiry_ms: u64,
        _ctx: &mut TxContext,
    ) {
        table::add(
            &mut registry.devices,
            device_id,
            DeviceEntry { meter_id, status: DEVICE_ACTIVE, expiry_ms },
        );
    }

    public fun create_meter(
        device_id: vector<u8>,
        device_pubkey: vector<u8>,
        producer_addr: address,
        ctx: &mut TxContext,
    ): EnergyMeter {
        EnergyMeter {
            id: object::new(ctx),
            device_id,
            device_pubkey,
            total_kwh: 0,
            last_reading_ts: 0,
            is_certified: false,
            producer_addr,
        }
    }

    public fun assert_device_registered(registry: &DeviceRegistry, device_id: &vector<u8>) {
        assert!(table::contains(&registry.devices, *device_id), errors::unknown_device());
    }

    public fun assert_device_active(
        registry: &DeviceRegistry,
        device_id: &vector<u8>,
        now_ms: u64,
    ) {
        assert!(table::contains(&registry.devices, *device_id), errors::unknown_device());
        let entry = table::borrow(&registry.devices, *device_id);
        assert!(entry.status == DEVICE_ACTIVE, errors::unknown_device());
        assert!(entry.expiry_ms > now_ms, errors::unknown_device());
    }

    public fun meter_pubkey(meter: &EnergyMeter): &vector<u8> {
        &meter.device_pubkey
    }

    public fun meter_device_id(meter: &EnergyMeter): &vector<u8> {
        &meter.device_id
    }

    public fun meter_id(meter: &EnergyMeter): ID {
        object::id(meter)
    }

    public fun producer_addr(meter: &EnergyMeter): address {
        meter.producer_addr
    }

    public fun certify_meter(meter: &mut EnergyMeter) {
        meter.is_certified = true;
    }

    public fun update_meter_reading(meter: &mut EnergyMeter, kwh_delta: u64, timestamp: u64) {
        meter.total_kwh = meter.total_kwh + kwh_delta;
        meter.last_reading_ts = timestamp;
    }

    public fun share_registry(registry: DeviceRegistry) {
        sui::transfer::share_object(registry);
    }

    public fun share_meter(meter: EnergyMeter) {
        sui::transfer::share_object(meter);
    }
}
