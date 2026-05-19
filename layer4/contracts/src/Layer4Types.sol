// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Layer4Types — L3→L4 interface structs (integration gates §5)
library Layer4Types {
    enum LifecycleState {
        DRAFT,
        MONITORING,
        TRIGGERED,
        DISPUTING,
        ARBITRATION_RESOLVED,
        SETTLEMENT_PENDING,
        SETTLED,
        EXPIRED
    }

    enum ExecutionStatus {
        NONE,
        QUEUED,
        SETTLEMENT_PENDING,
        CONFIRMING,
        SETTLED,
        ROLLED_BACK,
        CANCELLED,
        REJECTED
    }

    struct Obligation {
        address token;
        bytes32 partition;
        address to;
        uint256 value;
        bytes data;
        bool reversible;
    }

    struct ZKProof {
        bytes proof;
        bytes32 inputHash;
        bytes32 outputCommitment;
    }

    struct ExecutionRequest {
        bytes32 contractId;
        LifecycleState currentState;
        bytes32 obligationHash;
        bytes32 oracleSnapshotHash;
        ZKProof zkProof;
        uint256 disputeDeadline;
        bool activeChallenge;
        Obligation[] obligations;
    }
}
