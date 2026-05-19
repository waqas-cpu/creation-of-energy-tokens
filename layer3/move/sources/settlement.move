// Module: energy_grid::settlement
// Layer: 3
// Gates verified: 4.2 step 4, registry 1.1
/*
AGENT_OWNER: AGENT_SETTLEMENT
MODULE: settlement
PROVIDES: emit_trade
*/
module energy_grid::settlement {
    use sui::event;

    public struct TradeSettled has copy, drop {
        buyer: address,
        seller: address,
        kwh_micro: u64,
        price_usdc: u64,
    }

    public fun emit_trade(
        buyer: address,
        seller: address,
        kwh_micro: u64,
        price_usdc: u64,
    ) {
        event::emit(TradeSettled { buyer, seller, kwh_micro, price_usdc });
    }
}
