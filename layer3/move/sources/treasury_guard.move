// Module: energy_grid::treasury_guard
// Layer: 3
// Gates verified: O2.4, TC-01..TC-07
/*
AGENT_OWNER: AGENT_5 (Governance Agent)
MODULE: treasury_guard
PROVIDES: TreasuryGuard, MintAuth, borrow_treasury_cap
*/
module energy_grid::treasury_guard {
    use sui::coin::TreasuryCap;
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    use energy_grid::energy_token::{Self, AdminCap, ENERGY};
    use energy_grid::errors;

    public struct TreasuryGuard has key, store {
        id: UID,
        treasury_cap: TreasuryCap<ENERGY>,
        paused: bool,
    }

    public struct MintAuth has key, store {
        id: UID,
        meter_id: ID,
        remaining_kwh: u64,
    }

    public struct MintingPaused has copy, drop {
        paused: bool,
    }

    public fun wrap_and_share(
        _admin: &AdminCap,
        cap: TreasuryCap<ENERGY>,
        ctx: &mut TxContext,
    ) {
        let guard = TreasuryGuard {
            id: object::new(ctx),
            treasury_cap: cap,
            paused: false,
        };
        transfer::share_object(guard);
    }

    public fun borrow_treasury_cap(guard: &TreasuryGuard): &TreasuryCap<ENERGY> {
        &guard.treasury_cap
    }

    public(package) fun borrow_treasury_cap_mut(guard: &mut TreasuryGuard): &mut TreasuryCap<ENERGY> {
        assert!(!guard.paused, errors::minting_paused());
        &mut guard.treasury_cap
    }

    /// Layer 5 burn — allowed while minting is paused (gate 5.1.9).
    public fun borrow_treasury_for_burn(guard: &mut TreasuryGuard): &mut TreasuryCap<ENERGY> {
        &mut guard.treasury_cap
    }

    public fun assert_not_paused(guard: &TreasuryGuard) {
        assert!(!guard.paused, errors::minting_paused());
    }

    public fun pause_minting(_admin: &AdminCap, guard: &mut TreasuryGuard) {
        guard.paused = true;
        sui::event::emit(MintingPaused { paused: true });
    }

    public fun unpause_minting(_admin: &AdminCap, guard: &mut TreasuryGuard) {
        guard.paused = false;
        sui::event::emit(MintingPaused { paused: false });
    }

    public fun issue_mint_auth(
        _admin: &AdminCap,
        meter_id: ID,
        max_kwh: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let auth = MintAuth {
            id: object::new(ctx),
            meter_id,
            remaining_kwh: max_kwh,
        };
        transfer::public_transfer(auth, recipient);
    }

    public fun consume_mint_quota(auth: &mut MintAuth, meter_id: ID, kwh: u64) {
        assert!(auth.meter_id == meter_id, errors::invalid_mint_auth());
        assert!(kwh <= auth.remaining_kwh, errors::quota_exceeded());
        auth.remaining_kwh = auth.remaining_kwh - kwh;
    }

    #[test_only]
    public fun destroy_guard_for_testing(guard: TreasuryGuard) {
        let TreasuryGuard { id, treasury_cap, paused: _ } = guard;
        object::delete(id);
        energy_token::destroy_treasury_for_testing(treasury_cap);
    }
}
