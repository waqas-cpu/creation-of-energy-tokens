/// Domain 2C — M-of-N consensus aggregation (G-L2-03).
module energy_oracle::aggregator {
    use sui::bcs;
    use sui::object::{Self, UID};
    use sui::table::{Self, Table};
    use sui::tx_context::TxContext;
    use sui::vec_set::{Self, VecSet};

    use energy_oracle::errors;
    use energy_oracle::types::{Self, CanonicalAttestation};

    public struct OracleAggregator has key, store {
        id: UID,
        approved_oracles: vector<address>,
        n: u64,
        m: u64,
    }

    public struct SpentProofs has key {
        id: UID,
        spent: Table<vector<u8>, bool>,
    }

    public struct AggregatedReading has copy, drop, store {
        meter_id: vector<u8>,
        median_kwh: u64,
        timestamp: u64,
        threshold_sig: vector<u8>,
        participating_nodes: vector<address>,
    }

    public fun create_aggregator(
        approved_oracles: vector<address>,
        ctx: &mut TxContext,
    ): OracleAggregator {
        let n = vector::length(&approved_oracles);
        let m = quorum_threshold(n);
        OracleAggregator {
            id: object::new(ctx),
            approved_oracles,
            n,
            m,
        }
    }

    public fun create_spent_proofs(ctx: &mut TxContext): SpentProofs {
        SpentProofs {
            id: object::new(ctx),
            spent: table::new(ctx),
        }
    }

    public fun quorum_threshold(n: u64): u64 {
        if (n == 0) {
            return 0
        };
        (2 * n + 2) / 3
    }

    public fun assert_oracle_approved(agg: &OracleAggregator, node: address) {
        assert!(vector::contains(&agg.approved_oracles, &node), errors::unknown_oracle_node());
    }

    public fun assert_quorum(agg: &OracleAggregator, valid_count: u64) {
        assert!(valid_count >= agg.m, errors::quorum_not_reached());
    }

    public fun assert_plausible_kwh(kwh_delta: u64, max_kwh: u64) {
        assert!(kwh_delta <= max_kwh, errors::physically_implausible());
    }

    public fun assert_plausible_default(kwh_delta: u64) {
        assert_plausible_kwh(kwh_delta, types::default_max_plausible_kwh());
    }

    public fun assert_proof_not_spent(spent: &SpentProofs, proof_hash: &vector<u8>) {
        assert!(!table::contains(&spent.spent, *proof_hash), errors::proof_replay());
    }

    public fun mark_proof_spent(spent: &mut SpentProofs, proof_hash: vector<u8>) {
        table::add(&mut spent.spent, proof_hash, true);
    }

    public fun median_kwh(values: &vector<u64>): u64 {
        let len = vector::length(values);
        assert!(len > 0, errors::quorum_not_reached());
        let mut sorted = *values;
        let mut i = 0;
        while (i < len) {
            let mut j = i + 1;
            while (j < len) {
                let a = *vector::borrow(&sorted, i);
                let b = *vector::borrow(&sorted, j);
                if (b < a) {
                    vector::swap(&mut sorted, i, j);
                };
                j = j + 1;
            };
            i = i + 1;
        };
        let mid = len / 2;
        if (len % 2 == 1) {
            *vector::borrow(&sorted, mid)
        } else {
            let a = *vector::borrow(&sorted, mid - 1);
            let b = *vector::borrow(&sorted, mid);
            (a + b) / 2
        }
    }

    public fun aggregate_batch(
        agg: &OracleAggregator,
        spent: &mut SpentProofs,
        attestations: vector<CanonicalAttestation>,
        oracle_signers: vector<address>,
        meter_id: vector<u8>,
        batch_nonce: u64,
        has_plausibility: bool,
    ): AggregatedReading {
        let n_att = vector::length(&attestations);
        let n_sig = vector::length(&oracle_signers);
        assert!(n_att == n_sig, errors::quorum_not_reached());
        assert_quorum(agg, n_sig);

        let mut seen_nodes = vec_set::empty();
        let mut kwh_values = vector::empty<u64>();
        let mut min_ts = 0u64;
        let mut max_ts = 0u64;
        let mut i = 0;
        while (i < n_att) {
            let att = vector::borrow(&attestations, i);
            let node = *vector::borrow(&oracle_signers, i);
            assert_oracle_approved(agg, node);
            assert!(!vec_set::contains(&seen_nodes, &node), errors::duplicate_signature());
            vec_set::insert(&mut seen_nodes, node);
            assert!(
                *types::canonical_device_id(att) == meter_id,
                errors::window_mismatch(),
            );
            assert_plausible_default(types::canonical_kwh(att));
            let ts = types::canonical_timestamp_ms(att);
            if (i == 0) {
                min_ts = ts;
                max_ts = ts;
            } else {
                if (ts < min_ts) min_ts = ts;
                if (ts > max_ts) max_ts = ts;
            };
            vector::push_back(&mut kwh_values, types::canonical_kwh(att));
            i = i + 1;
        };
        assert!(max_ts - min_ts <= types::aggregation_window_ms(), errors::window_mismatch());
        assert!(has_plausibility, errors::missing_plausibility());

        let median = median_kwh(&kwh_values);
        let mut proof_material = meter_id;
        vector::append(&mut proof_material, bcs::to_bytes(&median));
        vector::append(&mut proof_material, bcs::to_bytes(&max_ts));
        vector::append(&mut proof_material, bcs::to_bytes(&batch_nonce));
        let proof_hash = sui::hash::blake2b256(&proof_material);
        assert_proof_not_spent(spent, &proof_hash);
        mark_proof_spent(spent, proof_hash);

        AggregatedReading {
            meter_id,
            median_kwh: median,
            timestamp: max_ts,
            threshold_sig: proof_hash,
            participating_nodes: oracle_signers,
        }
    }

    public fun agg_median_kwh(a: &AggregatedReading): u64 { a.median_kwh }
    public fun agg_timestamp(a: &AggregatedReading): u64 { a.timestamp }
    public fun agg_threshold_sig(a: &AggregatedReading): vector<u8> { a.threshold_sig }

    public fun share_aggregator(agg: OracleAggregator) {
        sui::transfer::share_object(agg);
    }

    public fun share_spent_proofs(spent: SpentProofs) {
        sui::transfer::share_object(spent);
    }
}
