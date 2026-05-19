// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Layer4Errors — structured errors (vertical decomp §5, gates Appendix)
library Layer4Errors {
    // 1000-1099 Transaction Builder
    uint16 internal constant ERR_TB_INVALID_CALLDATA = 1000;
    uint16 internal constant ERR_TB_GAS_ESTIMATION_FAILED = 1001;
    uint16 internal constant ERR_TB_CHAIN_ID_MISMATCH = 1002;
    uint16 internal constant ERR_TB_NONCE_COLLISION = 1003;
    uint16 internal constant ERR_TB_PREFLIGHT_REVERT = 1004;

    // 1100-1199 Multi-sig Gateway
    uint16 internal constant ERR_MEG_INSUFFICIENT_SIGNATURES = 1100;
    uint16 internal constant ERR_MEG_INVALID_SIGNATURE = 1101;
    uint16 internal constant ERR_MEG_ZK_PROOF_INVALID = 1102;
    uint16 internal constant ERR_MEG_DISPUTE_WINDOW_ACTIVE = 1103;
    uint16 internal constant ERR_MEG_EMERGENCY_PAUSE_ACTIVE = 1104;
    uint16 internal constant ERR_MEG_THRESHOLD_NOT_MET = 1105;

    // 1200-1299 Settlement Confirmer
    uint16 internal constant ERR_SCR_CONFIRMATION_TIMEOUT = 1200;
    uint16 internal constant ERR_SCR_REVERT_DETECTED = 1201;
    uint16 internal constant ERR_SCR_ORPHANED_BLOCK = 1202;
    uint16 internal constant ERR_SCR_IDEMPOTENCY_VIOLATION = 1203;
    uint16 internal constant ERR_SCR_PARTIAL_SETTLEMENT = 1204;

    // 1300-1399 Gas Optimizer
    uint16 internal constant ERR_GO_GAS_CAP_EXCEEDED = 1300;
    uint16 internal constant ERR_GO_MAX_RETRIES_EXHAUSTED = 1301;

    // Gate 4.0.x style (integration gates naming)
    uint16 internal constant ERR_INVALID_STATE = 4001;
    uint16 internal constant ERR_ARBITRATION_DENIED = 4002;
    uint16 internal constant ERR_UNAUTHORIZED = 4003;
    uint16 internal constant ERR_MISSING_ZK_PROOF = 4010;
    uint16 internal constant ERR_ZK_VERIFICATION_FAILED = 4011;
    uint16 internal constant ERR_INPUT_HASH_MISMATCH = 4012;
    uint16 internal constant ERR_CONDITION_NOT_MET = 4013;
    uint16 internal constant ERR_PROOF_REPLAY = 4014;
    uint16 internal constant ERR_DISPUTE_WINDOW_OPEN = 4020;
    uint16 internal constant ERR_ACTIVE_CHALLENGE = 4021;
    uint16 internal constant ERR_KYC_EXPIRED = 4030;
    uint16 internal constant ERR_PARTITION_TRANSFER_DENIED = 4032;
    uint16 internal constant ERR_SANCTIONED = 4034;
    uint16 internal constant ERR_EXECUTION_IN_FLIGHT = 4040;
    uint16 internal constant ERR_ALREADY_EXECUTED = 4041;
    uint16 internal constant ERR_OBLIGATION_TAMPERED = 4042;
    uint16 internal constant ERR_UNEXPECTED_VALUE = 4054;

    error Layer4Error(uint16 code, string message, bytes32 context);
}
