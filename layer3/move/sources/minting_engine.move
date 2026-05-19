// Module: energy_grid::minting_engine
// Layer: 3
// Gates verified: 3.1 M1-M6, MP1-MP4, S5.2, S5.3
/*
AGENT_OWNER: AGENT_1 (Mint Agent)
MODULE: minting_engine
DEPENDS_ON: energy_token, meter_registry, compliance_registry, treasury_guard, batch_receipt
PROVIDES: mint_energy, transfer_energy, burn_on_redemption, MintingProof
INVARIANT: total_supply(ENERGY) == sum(meter.total_kwh) * 1_000_000
*/
module energy_grid::minting_engine {
    use std::bcs;
    use sui::coin::{Self, Coin};
    use sui::ecdsa_k1;
    use sui::hash;
    use sui::object::{Self, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use energy_grid::batch_receipt;
    use energy_grid::compliance_registry::{Self, ComplianceRegistry};
    use energy_grid::energy_token::{Self, ENERGY, EnergyBatch, EnergyMeter};
    use energy_grid::errors;
    use energy_grid::meter_registry;
    use energy_grid::treasury_guard::{Self, TreasuryGuard};

    const SECP256K1: u8 = 0;
    const MAX_KWH_PER_READING: u64 = 1_000_000_000;

    public struct MintingProof has copy, drop, store {
        meter_id: ID,
        kwh: u64,
        batch_id: ID,
    }

    public struct EnergyMinted has copy, drop {
        meter_id: ID,
        producer: address,
        kwh: u64,
        timestamp: u64,
        batch_id: ID,
    }

    /// PRE: oracle_sig valid; meter.is_certified; producer KYC cleared
    /// POST: meter.total_kwh += kwh; Coin balance == kwh * 1_000_000; EnergyBatch issued
    public entry fun mint_energy(
        guard: &mut TreasuryGuard,
        meter: &mut EnergyMeter,
        kwh: u64,
        reading_timestamp: u64,
        oracle_sig: vector<u8>,
        source: u8,
        compliance: &ComplianceRegistry,
        ctx: &mut TxContext,
    ): Coin<ENERGY> {
        mint_energy_impl(
            guard,
            meter,
            kwh,
            reading_timestamp,
            oracle_sig,
            source,
            compliance,
            false,
            ctx,
        )
    }

    fun mint_energy_impl(
        guard: &mut TreasuryGuard,
        meter: &mut EnergyMeter,
        kwh: u64,
        reading_timestamp: u64,
        oracle_sig: vector<u8>,
        source: u8,
        compliance: &ComplianceRegistry,
        skip_sig_verify: bool,
        ctx: &mut TxContext,
    ): Coin<ENERGY> {
        let producer = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);

        // M1
        assert!(kwh > 0, errors::zero_mint());
        // M6
        assert!(vector::length(&oracle_sig) == 64, errors::invalid_signature_format());
        // M2
        if (!skip_sig_verify) {
            assert!(
                verify_oracle_sig(meter, kwh, reading_timestamp, &oracle_sig),
                errors::invalid_attestation(),
            );
        };
        // S5.3b
        assert_timestamp_in_range(reading_timestamp, now);
        // M3
        assert!(now > energy_token::meter_last_ts(meter), errors::stale_reading());
        // M4
        assert!(energy_token::meter_is_certified(meter), errors::uncertified_device());
        // M5
        compliance_registry::assert_cleared(compliance, producer, ctx);
        assert!(producer == energy_token::meter_producer(meter), errors::invalid_attestation());

        treasury_guard::assert_not_paused(guard);

        meter_registry::update_meter_reading(meter, kwh, now);

        let mint_amount = kwh * energy_token::kwh_scale();
        let coin = coin::mint(treasury_guard::borrow_treasury_cap_mut(guard), mint_amount, ctx);

        let batch = batch_receipt::issue_batch(
            producer,
            kwh,
            source,
            meter,
            oracle_sig,
            reading_timestamp,
            ctx,
        );
        let batch_id = object::id(&batch);

        sui::event::emit(EnergyMinted {
            meter_id: energy_token::meter_id(meter),
            producer,
            kwh,
            timestamp: now,
            batch_id,
        });

        transfer::public_transfer(batch, producer);
        coin
    }

    #[test_only]
    public fun mint_energy_for_testing(
        guard: &mut TreasuryGuard,
        meter: &mut EnergyMeter,
        kwh: u64,
        reading_timestamp: u64,
        oracle_sig: vector<u8>,
        source: u8,
        compliance: &ComplianceRegistry,
        ctx: &mut TxContext,
    ): Coin<ENERGY> {
        mint_energy_impl(
            guard,
            meter,
            kwh,
            reading_timestamp,
            oracle_sig,
            source,
            compliance,
            true,
            ctx,
        )
    }

    /// Consumes mint output on success; use in `#[expected_failure]` tests so the compiler sees a drop path.
    #[test_only]
    public fun mint_energy_for_testing_expect_abort(
        guard: &mut TreasuryGuard,
        meter: &mut EnergyMeter,
        kwh: u64,
        reading_timestamp: u64,
        oracle_sig: vector<u8>,
        source: u8,
        compliance: &ComplianceRegistry,
        ctx: &mut TxContext,
    ) {
        let coin = mint_energy_for_testing(
            guard,
            meter,
            kwh,
            reading_timestamp,
            oracle_sig,
            source,
            compliance,
            ctx,
        );
        transfer::public_transfer(coin, tx_context::sender(ctx));
    }

    /// F3.2 — P2P transfer, no KYC (Gate 5.1).
    public fun transfer_energy(coin: Coin<ENERGY>, recipient: address) {
        transfer::public_transfer(coin, recipient);
    }

    /// B1-B4 + BP1-BP3 — atomic burn and mark (A3.3).
    public entry fun burn_on_redemption(
        guard: &mut TreasuryGuard,
        coin: Coin<ENERGY>,
        batch: &mut EnergyBatch,
        ctx: &mut TxContext,
    ) {
        let owner = tx_context::sender(ctx);
        assert!(owner == energy_token::batch_producer(batch), errors::owner_mismatch());
        batch_receipt::assert_redeemable(batch, coin::value(&coin));
        batch_receipt::mark_redeemed(batch);
        coin::burn(treasury_guard::borrow_treasury_cap_mut(guard), coin);
    }

    fun verify_oracle_sig(
        meter: &EnergyMeter,
        kwh: u64,
        timestamp: u64,
        sig: &vector<u8>,
    ): bool {
        let meter_id = energy_token::meter_id(meter);
        let digest = attestation_digest(&meter_id, kwh, timestamp);
        let pubkey = *energy_token::meter_pubkey(meter);
        ecdsa_k1::secp256k1_verify(sig, &pubkey, &digest, SECP256K1)
    }

    /// Gate S5.2c — blake2b256(meter_id || kwh || timestamp).
    fun attestation_digest(meter_id: &ID, kwh: u64, timestamp: u64): vector<u8> {
        let mut msg = object::id_to_bytes(meter_id);
        vector::append(&mut msg, bcs::to_bytes(&kwh));
        vector::append(&mut msg, bcs::to_bytes(&timestamp));
        hash::blake2b256(&msg)
    }

    fun assert_timestamp_in_range(reading_ts: u64, now: u64) {
        let tol = energy_token::timestamp_tolerance_ms();
        assert!(reading_ts + tol >= now, errors::timestamp_out_of_range());
        assert!(reading_ts <= now + tol, errors::timestamp_out_of_range());
    }
}
