/// Domain 2D — Economic validation via Pyth (P-01..P-05).
module energy_oracle::pyth_validation {
    use sui::object::{Self, UID};
    use sui::table::{Self, Table};
    use sui::tx_context::TxContext;

    use energy_oracle::errors;
    use energy_oracle::types;

    const STATUS_UNKNOWN: u8 = 0;

    public struct PriceFeedRegistry has key, store {
        id: UID,
        whitelisted_feed_ids: Table<vector<u8>, bool>,
    }

    public struct PriceSnapshot has copy, drop {
        feed_id: vector<u8>,
        price: u64,
        confidence: u64,
        timestamp_ms: u64,
        status: u8,
    }

    public fun new_price_snapshot(
        feed_id: vector<u8>,
        price: u64,
        confidence: u64,
        timestamp_ms: u64,
        status: u8,
    ): PriceSnapshot {
        PriceSnapshot { feed_id, price, confidence, timestamp_ms, status }
    }

    public fun create_registry(ctx: &mut TxContext): PriceFeedRegistry {
        PriceFeedRegistry {
            id: object::new(ctx),
            whitelisted_feed_ids: table::new(ctx),
        }
    }

    public fun whitelist_feed(registry: &mut PriceFeedRegistry, feed_id: vector<u8>) {
        if (!table::contains(&registry.whitelisted_feed_ids, feed_id)) {
            table::add(&mut registry.whitelisted_feed_ids, feed_id, true);
        };
    }

    public fun assert_feed_whitelisted(registry: &PriceFeedRegistry, feed_id: &vector<u8>) {
        assert!(
            table::contains(&registry.whitelisted_feed_ids, *feed_id),
            errors::unknown_feed_id(),
        );
    }

    public fun assert_confidence(snapshot: &PriceSnapshot) {
        assert!(snapshot.price > 0, errors::price_unavailable());
        let ratio_bps = (snapshot.confidence * 10_000) / snapshot.price;
        assert!(ratio_bps <= types::max_confidence_bps(), errors::price_confidence_too_wide());
    }

    public fun assert_fresh(snapshot: &PriceSnapshot, now_ms: u64) {
        assert!(
            snapshot.timestamp_ms >= now_ms - types::stale_price_threshold_ms(),
            errors::stale_price_feed(),
        );
    }

    public fun assert_available(snapshot: &PriceSnapshot) {
        assert!(snapshot.price > 0, errors::price_unavailable());
        assert!(snapshot.status != STATUS_UNKNOWN, errors::price_unavailable());
    }

    public fun assert_economic_plausibility(kwh_micro: u64, price_usdc_6d: u64) {
        let value = (kwh_micro / 1_000_000) * price_usdc_6d;
        let min_val = 10_000;
        let max_val = 5_000_000;
        assert!(value >= min_val, errors::economic_plausibility());
        assert!(value <= max_val * (kwh_micro / 1_000_000 + 1), errors::economic_plausibility());
    }

    public fun validate_for_trade(
        registry: &PriceFeedRegistry,
        snapshot: &PriceSnapshot,
        now_ms: u64,
        kwh_micro: u64,
    ) {
        assert_feed_whitelisted(registry, &snapshot.feed_id);
        assert_available(snapshot);
        assert_confidence(snapshot);
        assert_fresh(snapshot, now_ms);
        assert_economic_plausibility(kwh_micro, snapshot.price);
    }

    public fun share_registry(registry: PriceFeedRegistry) {
        sui::transfer::share_object(registry);
    }
}
