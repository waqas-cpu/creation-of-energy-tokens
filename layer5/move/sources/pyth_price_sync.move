/// Gate 5.3.2 — sync local PriceFeed from Pyth (client updates Pyth first in same PTB).
module energy_settlement::pyth_price_sync {
    use sui::clock::Clock;
    use sui::event;

    use energy_settlement::l5_errors;
    use energy_settlement::usdc_settlement::{Self, PriceFeed};

    public struct PythPriceApplied has copy, drop {
        price: u64,
        publish_time_ms: u64,
        confidence_bps: u64,
        expo: u8,
    }

    /// Apply normalized Pyth fields after `pyth::update_price_feeds` in the same PTB.
    public fun apply_pyth_snapshot(
        feed: &mut PriceFeed,
        price: u64,
        expo: u8,
        conf: u64,
        publish_time_ms: u64,
        clock: &Clock,
    ) {
        let normalized = usdc_settlement::pyth_to_u128(price, expo);
        assert!(normalized <= 18446744073709551615, l5_errors::arithmetic_overflow());
        let price_u64 = (normalized as u64);
        let confidence_bps = if (price_u64 == 0) {
            0
        } else {
            let c = (conf as u128) * 10_000 / (price_u64 as u128);
            if (c > 18446744073709551615) 18446744073709551615 else (c as u64)
        };
        let now = sui::clock::timestamp_ms(clock);
        assert!(publish_time_ms <= now, l5_errors::stale_price());
        usdc_settlement::update_price(feed, price_u64, publish_time_ms, confidence_bps);
        event::emit(PythPriceApplied {
            price: price_u64,
            publish_time_ms,
            confidence_bps,
            expo,
        });
    }

    /// Entry for operator/keeper PTB (after Pyth update step).
    public entry fun sync_energy_price_feed(
        feed: &mut PriceFeed,
        price: u64,
        expo: u8,
        conf: u64,
        publish_time_ms: u64,
        clock: &Clock,
    ) {
        apply_pyth_snapshot(feed, price, expo, conf, publish_time_ms, clock);
    }
}
