/// Gate 5.1 — utility::billing redemption PTB (integration gates §3).
module energy_settlement::utility_billing {
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use energy_grid::compliance_registry::{Self, ComplianceRegistry};
    use energy_grid::energy_token::{Self, ENERGY, EnergyBatch, EnergyMeter};
    use energy_grid::treasury_guard::TreasuryGuard;
    use energy_settlement::batch_redemption;
    use energy_settlement::billing_operator::{Self, BillingOperatorCap};
    use energy_settlement::burn_engine;
    use energy_settlement::credit_validation;
    use energy_settlement::jurisdiction_policy;
    use energy_settlement::jurisdiction_policy::JurisdictionPolicy;
    use energy_settlement::l5_errors;
    use energy_settlement::redemption_registry::{Self as redemption_reg_mod, RedemptionRegistry};
    use energy_settlement::version;

    const BILLING_PERIOD_TOLERANCE_MS: u64 = 172_800_000; // 48h

    public struct BurnPrecommit has copy, drop {
        batch_id: ID,
        consumer: address,
        kwh: u64,
        timestamp: u64,
    }

    public struct BillingReceipt has key, store {
        id: UID,
        batch_id: ID,
        kwh: u64,
        burned_at: u64,
    }

    public struct BillingPeriodMismatch has copy, drop {
        consumer: address,
        billing_period_end: u64,
        now: u64,
    }

    public fun redeem_billing(
        guard: &mut TreasuryGuard,
        batch: &mut EnergyBatch,
        mut coin: Coin<ENERGY>,
        meter: &EnergyMeter,
        compliance: &ComplianceRegistry,
        jurisdiction: &JurisdictionPolicy,
        redemption_reg: &mut RedemptionRegistry,
        redemption_id: vector<u8>,
        kwh: u64,
        billing_period_end: u64,
        billing_period_override: bool,
        operator_cap: &BillingOperatorCap,
        ctx: &mut TxContext,
    ): BillingReceipt {
        let _v = version::version();
        let consumer = tx_context::sender(ctx);
        let now = tx_context::epoch_timestamp_ms(ctx);

        compliance_registry::assert_consumer(compliance, consumer, ctx);
        credit_validation::validate_credit(&coin, batch, kwh);
        assert!(energy_token::meter_id(meter) == energy_token::batch_meter_id(batch), l5_errors::meter_not_certified());
        assert!(energy_token::meter_is_certified(meter), l5_errors::meter_not_certified());

        let producer_j = compliance_registry::jurisdiction_of(compliance, energy_token::batch_producer(batch));
        let consumer_j = compliance_registry::jurisdiction_of(compliance, consumer);
        jurisdiction_policy::assert_allowed(jurisdiction, producer_j, consumer_j);

        if (!billing_period_ok(now, billing_period_end)) {
            event::emit(BillingPeriodMismatch { consumer, billing_period_end, now });
            assert!(billing_period_override, l5_errors::billing_period_requires_override());
            billing_operator::assert_cap(operator_cap);
        };

        let rid_for_mark = redemption_id;
        redemption_reg_mod::register_redemption_id(redemption_reg, redemption_id);

        let batch_id = object::id(batch);
        event::emit(BurnPrecommit { batch_id, consumer, kwh, timestamp: now });

        batch_redemption::mark_redeemed(batch, rid_for_mark, consumer, ctx);

        let required = credit_validation::checked_mul_kwh_scale(kwh);
        let burn_coin = if (coin::value(&coin) == required) {
            coin
        } else {
            let remainder = coin::split(&mut coin, required, ctx);
            transfer::public_transfer(coin, consumer);
            remainder
        };
        burn_engine::burn_energy(guard, burn_coin, kwh, redemption_id, consumer, ctx);

        BillingReceipt {
            id: object::new(ctx),
            batch_id,
            kwh,
            burned_at: now,
        }
    }

    fun billing_period_ok(now: u64, period_end: u64): bool {
        if (now >= period_end) {
            now - period_end <= BILLING_PERIOD_TOLERANCE_MS
        } else {
            period_end - now <= BILLING_PERIOD_TOLERANCE_MS
        }
    }

    public fun transfer_receipt(receipt: BillingReceipt, recipient: address) {
        transfer::public_transfer(receipt, recipient);
    }
}
