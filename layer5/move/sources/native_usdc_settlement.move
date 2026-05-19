/// Gate 5.3.9 — settlement with native Circle USDC (`usdc::usdc::USDC`).
module energy_settlement::native_usdc_settlement {
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use energy_grid::compliance_registry::{Self, ComplianceRegistry};
    use energy_grid::energy_token::{Self, ENERGY};
    use energy_settlement::l5_errors;
    use energy_settlement::usdc_settlement::{Self, EnergyMarketplace, PriceFeed};
    use energy_settlement::version;
    use usdc::usdc::USDC;

    public struct NativeUSDCSettled has copy, drop {
        seller: address,
        buyer: address,
        energy_kwh: u64,
        usdc_amount: u64,
        price: u64,
        timestamp: u64,
        wormhole_vaa_sequence: u64,
    }

    public fun settle_native_usdc(
        marketplace: &EnergyMarketplace,
        compliance: &ComplianceRegistry,
        price_feed: &PriceFeed,
        mut energy_coin: Coin<ENERGY>,
        usdc_coin: Coin<USDC>,
        slippage_bps: u64,
        wormhole_vaa_sequence: u64,
        ctx: &mut TxContext,
    ) {
        let _v = version::version();
        let seller = tx_context::sender(ctx);
        let buyer = usdc_settlement::marketplace_buyer(marketplace);
        let now = tx_context::epoch_timestamp_ms(ctx);

        compliance_registry::assert_cleared(compliance, seller, ctx);
        compliance_registry::assert_cleared(compliance, buyer, ctx);

        let energy_value = coin::value(&energy_coin);
        let usdc_value = coin::value(&usdc_coin);
        usdc_settlement::assert_settlement_price_feed(price_feed, now);
        usdc_settlement::assert_settlement_slippage(
            energy_value,
            usdc_value,
            usdc_settlement::price_feed_price(price_feed),
            slippage_bps,
        );
        usdc_settlement::assert_marketplace_liquidity(marketplace, usdc_value);

        let energy_kwh = energy_value / energy_token::kwh_scale();
        transfer::public_transfer(energy_coin, buyer);
        transfer::public_transfer(usdc_coin, seller);

        event::emit(NativeUSDCSettled {
            seller,
            buyer,
            energy_kwh,
            usdc_amount: usdc_value,
            price: usdc_settlement::price_feed_price(price_feed),
            timestamp: now,
            wormhole_vaa_sequence,
        });
    }

    public entry fun settle_native_usdc_entry(
        marketplace: &EnergyMarketplace,
        compliance: &ComplianceRegistry,
        price_feed: &PriceFeed,
        energy_coin: Coin<ENERGY>,
        usdc_coin: Coin<USDC>,
        slippage_bps: u64,
        wormhole_vaa_sequence: u64,
        ctx: &mut TxContext,
    ) {
        settle_native_usdc(
            marketplace,
            compliance,
            price_feed,
            energy_coin,
            usdc_coin,
            slippage_bps,
            wormhole_vaa_sequence,
            ctx,
        );
    }
}
