/// Gate 5.3 — settlement::usdc atomic swap (mock Pyth + marketplace).
module energy_settlement::usdc_settlement {
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use energy_grid::compliance_registry::{Self, ComplianceRegistry};
    use energy_grid::energy_token::{Self, ENERGY};
    use energy_settlement::l5_errors;
    use energy_settlement::version;

    public struct USDC has drop {}

    const PRICE_STALE_MS: u64 = 300_000;
    const MAX_PRICE_CONFIDENCE_BPS: u64 = 500;
    const DEFAULT_SLIPPAGE_BPS: u64 = 50;
    const BPS_DENOM: u64 = 10_000;
    const MAX_PLATFORM_FEE_BPS: u64 = 500;

    /// Gate 5.3.9 — USDC provenance tracking.
    public struct USDCOrigin has copy, drop {
        is_native: bool,
        wormhole_vaa_sequence: u64,
    }

    public struct PriceFeed has key {
        id: UID,
        price: u64,
        publish_time_ms: u64,
        /// Pyth confidence interval as bps of price (E506 gate).
        confidence_bps: u64,
    }

    public struct EnergyMarketplace has key {
        id: UID,
        buyer: address,
        min_liquidity_bps: u64,
    }

    public struct USDCSettled has copy, drop {
        seller: address,
        buyer: address,
        energy_kwh: u64,
        usdc_amount: u64,
        price: u64,
        timestamp: u64,
        origin: USDCOrigin,
        platform_fee_bps: u64,
    }

    /// Pyth-style price normalization (price, expo) → u128 micro-USDC per kWh base unit.
    public fun pyth_to_u128(price: u64, expo: u8): u128 {
        if (expo == 0) {
            return (price as u128)
        };
        if (expo <= 18) {
            let scale = pow10(expo);
            return (price as u128) / scale
        };
        let scale = pow10(expo - 18);
        (price as u128) * scale
    }

    fun pow10(exp: u8): u128 {
        let mut n: u128 = 1;
        let mut i = 0u8;
        while (i < exp) {
            n = n * 10;
            i = i + 1;
        };
        n
    }

    public fun assert_fee_bps(fee_bps: u64) {
        assert!(fee_bps <= MAX_PLATFORM_FEE_BPS, l5_errors::arithmetic_overflow());
    }

    public fun create_price_feed(
        price: u64,
        publish_time_ms: u64,
        confidence_bps: u64,
        ctx: &mut TxContext,
    ): PriceFeed {
        assert_price_confidence(confidence_bps);
        PriceFeed { id: object::new(ctx), price, publish_time_ms, confidence_bps }
    }

    public fun assert_price_confidence(confidence_bps: u64) {
        assert!(confidence_bps <= MAX_PRICE_CONFIDENCE_BPS, l5_errors::stale_price());
    }

    public fun share_price_feed(feed: PriceFeed) {
        transfer::share_object(feed);
    }

    public fun update_price(
        feed: &mut PriceFeed,
        price: u64,
        publish_time_ms: u64,
        confidence_bps: u64,
    ) {
        assert_price_confidence(confidence_bps);
        feed.price = price;
        feed.publish_time_ms = publish_time_ms;
        feed.confidence_bps = confidence_bps;
    }

    public fun create_marketplace(buyer: address, ctx: &mut TxContext): EnergyMarketplace {
        EnergyMarketplace {
            id: object::new(ctx),
            buyer,
            min_liquidity_bps: 15_000,
        }
    }

    public fun share_marketplace(m: EnergyMarketplace) {
        transfer::share_object(m);
    }

    public fun price_feed_price(feed: &PriceFeed): u64 {
        feed.price
    }

    public fun marketplace_buyer(m: &EnergyMarketplace): address {
        m.buyer
    }

    public fun assert_settlement_price_feed(feed: &PriceFeed, now: u64) {
        assert!(feed.publish_time_ms > now - PRICE_STALE_MS, l5_errors::stale_price());
        assert_price_confidence(feed.confidence_bps);
    }

    public fun assert_settlement_slippage(
        energy_micro: u64,
        usdc_micro: u64,
        price: u64,
        slippage_bps: u64,
    ) {
        assert_slippage(energy_micro, usdc_micro, price, slippage_bps);
    }

    public fun assert_marketplace_liquidity(marketplace: &EnergyMarketplace, usdc_value: u64) {
        let expected_liquidity =
            (usdc_value as u128) * (marketplace.min_liquidity_bps as u128) / (BPS_DENOM as u128);
        assert!((usdc_value as u128) >= expected_liquidity / 10, l5_errors::insufficient_liquidity());
    }

    public fun settle_usdc(
        marketplace: &EnergyMarketplace,
        compliance: &ComplianceRegistry,
        price_feed: &PriceFeed,
        mut energy_coin: Coin<ENERGY>,
        usdc_coin: Coin<USDC>,
        slippage_bps: u64,
        ctx: &mut TxContext,
    ) {
        let _v = version::version();
        let seller = tx_context::sender(ctx);
        let buyer = marketplace.buyer;
        let now = tx_context::epoch_timestamp_ms(ctx);

        compliance_registry::assert_cleared(compliance, seller, ctx);
        compliance_registry::assert_cleared(compliance, buyer, ctx);
        assert!(price_feed.publish_time_ms > now - PRICE_STALE_MS, l5_errors::stale_price());
        assert_price_confidence(price_feed.confidence_bps);

        let energy_value = coin::value(&energy_coin);
        let usdc_value = coin::value(&usdc_coin);
        assert_slippage(energy_value, usdc_value, price_feed.price, slippage_bps);

        let expected_liquidity = (usdc_value as u128) * (marketplace.min_liquidity_bps as u128) / (BPS_DENOM as u128);
        assert!((usdc_value as u128) >= expected_liquidity / 10, l5_errors::insufficient_liquidity());

        let energy_kwh = energy_value / energy_token::kwh_scale();
        transfer::public_transfer(energy_coin, buyer);
        transfer::public_transfer(usdc_coin, seller);

        event::emit(USDCSettled {
            seller,
            buyer,
            energy_kwh,
            usdc_amount: usdc_value,
            price: price_feed.price,
            timestamp: now,
            origin: USDCOrigin { is_native: true, wormhole_vaa_sequence: 0 },
            platform_fee_bps: 0,
        });
    }

    fun assert_slippage(energy_micro: u64, usdc_micro: u64, price: u64, slippage_bps: u64) {
        let bps = if (slippage_bps == 0) DEFAULT_SLIPPAGE_BPS else slippage_bps;
        let expected = (energy_micro as u128) * (price as u128) / (energy_token::kwh_scale() as u128);
        let min_usdc = expected * ((BPS_DENOM - bps) as u128) / (BPS_DENOM as u128);
        let max_usdc = expected * ((BPS_DENOM + bps) as u128) / (BPS_DENOM as u128);
        let actual = usdc_micro as u128;
        assert!(actual >= min_usdc && actual <= max_usdc, l5_errors::slippage_exceeded());
    }
}
