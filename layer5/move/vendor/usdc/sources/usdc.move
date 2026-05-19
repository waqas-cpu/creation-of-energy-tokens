/// Circle-compatible native USDC witness (mainnet: 0xdba34672…::usdc::USDC).
module usdc::usdc {
    use std::option;
    use sui::coin::{Self, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::TxContext;

    public struct USDC has drop {}

    /// Test-only: create native USDC currency (witness must stay in this module).
    #[test_only]
    public fun init_currency_for_testing(ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            USDC {},
            6,
            b"USDC",
            b"USD Coin",
            b"",
            option::none(),
            ctx,
        );
        transfer::public_freeze_object(metadata);
        transfer::public_share_object(treasury);
    }

    #[test_only]
    public fun mint_for_testing(
        treasury: &mut TreasuryCap<USDC>,
        amount: u64,
        ctx: &mut TxContext,
    ): coin::Coin<USDC> {
        coin::mint(treasury, amount, ctx)
    }
}
