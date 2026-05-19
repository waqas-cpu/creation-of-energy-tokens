// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
 * Module: ExecutionEngine — Layer 4 value-transfer boundary
 * Gates: 4.0–4.4 pre-execution, 4.7 settlement/idempotency (integration gates)
 * AGENT_OWNER: AGENT_L4_CORE
 */

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Layer4Types} from "./Layer4Types.sol";
import {Layer4Errors} from "./Layer4Errors.sol";
import {IZKVerifier} from "./interfaces/IZKVerifier.sol";
import {IERC1400} from "./interfaces/IERC1400.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {ISanctionsOracle} from "./interfaces/ISanctionsOracle.sol";

contract ExecutionEngine is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant CONFIRMATION_DEPTH = 12;
    uint256 public constant DISPUTE_BUFFER_SECONDS = 300;
    uint256 public constant MAX_GAS_CAP = 15_000_000;

    IZKVerifier public immutable zkVerifier;
    IIdentityRegistry public immutable identityRegistry;
    ISanctionsOracle public immutable sanctionsOracle;

    bool public emergencyPause;
    address public governance;

    mapping(address => bool) public relayers;
    mapping(address => bool) public parties;

    mapping(bytes32 => bytes32) public registeredObligationHash;
    mapping(bytes32 => bytes32) public oracleSnapshotHash;
    mapping(bytes32 => uint256) public disputeDeadlines;
    mapping(bytes32 => bool) public arbitrationOverrides;
    mapping(bytes32 => bool) public activeChallenge;
    mapping(bytes32 => bool) public arbitrationMet;

    mapping(bytes32 => Layer4Types.ExecutionStatus) public executionStatus;
    mapping(bytes32 => uint256) public executionBlock;
    mapping(bytes32 => uint256) public executionNonce;
    mapping(bytes32 => bytes32) public attemptHash;

    mapping(bytes32 => bool) public executed;
    mapping(bytes32 => bool) public usedProofs;

    /// @notice Gate 4.8.6 — execution log for audit / dispute resolution
    mapping(bytes32 => bytes32) public executionLog;

    event ExecutionInitiated(
        bytes32 indexed contractId,
        bytes32 indexed batchId,
        uint256 obligationsCount,
        address indexed executor,
        uint256 timestamp
    );

    event TransactionSubmitted(
        bytes32 indexed contractId, bytes32 indexed txHash, uint256 nonce, uint256 gasLimit, uint256 maxFeePerGas
    );

    event TransactionConfirmed(
        bytes32 indexed contractId,
        bytes32 indexed txHash,
        uint256 blockNumber,
        uint256 confirmationDepth,
        uint256 gasUsed
    );

    event ObligationTransferred(
        bytes32 indexed contractId, bytes32 indexed partition, address indexed to, uint256 value, bytes32 oracleRef
    );

    event ExecutionRolledBack(bytes32 indexed contractId, bytes32 attemptHash, string reason);

    event SettlementComplete(
        bytes32 indexed contractId,
        bytes32 indexed batchId,
        uint256 totalGasUsed,
        uint256 totalValueTransferred,
        uint256 settlementTimestamp
    );

    event IdempotencyViolation(
        bytes32 indexed contractId,
        bytes32 indexed idempotencyKey,
        bytes32 originalTxHash,
        bytes32 attemptedTxHash
    );

    event EmergencyPauseSet(bool paused);

    constructor(address _zkVerifier, address _identityRegistry, address _sanctionsOracle, address _governance) {
        if (_zkVerifier == address(0) || _identityRegistry == address(0) || _sanctionsOracle == address(0)) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_TB_INVALID_CALLDATA, "zero address", bytes32(0));
        }
        zkVerifier = IZKVerifier(_zkVerifier);
        identityRegistry = IIdentityRegistry(_identityRegistry);
        sanctionsOracle = ISanctionsOracle(_sanctionsOracle);
        governance = _governance;
    }

    modifier onlyGovernance() {
        if (msg.sender != governance) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_UNAUTHORIZED, "not governance", bytes32(0));
        }
        _;
    }

    modifier whenNotPaused() {
        if (emergencyPause) {
            revert Layer4Errors.Layer4Error(
                Layer4Errors.ERR_MEG_EMERGENCY_PAUSE_ACTIVE, "paused", bytes32(uint256(uint160(msg.sender)))
            );
        }
        _;
    }

    function setRelayer(address account, bool allowed) external onlyGovernance {
        relayers[account] = allowed;
    }

    function setParty(address account, bool allowed) external onlyGovernance {
        parties[account] = allowed;
    }

    function setEmergencyPause(bool paused) external onlyGovernance {
        emergencyPause = paused;
        emit EmergencyPauseSet(paused);
    }

    function registerContract(
        bytes32 contractId,
        bytes32 obligationHash,
        bytes32 oracleHash,
        uint256 disputeDeadline
    ) external onlyGovernance {
        registeredObligationHash[contractId] = obligationHash;
        oracleSnapshotHash[contractId] = oracleHash;
        disputeDeadlines[contractId] = disputeDeadline;
        executionStatus[contractId] = Layer4Types.ExecutionStatus.NONE;
    }

    function setArbitrationOutcome(bytes32 contractId, bool met) external onlyGovernance {
        arbitrationMet[contractId] = met;
        arbitrationOverrides[contractId] = true;
    }

    /// @notice Gate 4.0–4.4 + obligation transfer (atomic batch)
    function executeBatch(
        bytes32 contractId,
        Layer4Types.ExecutionRequest calldata request,
        bytes32 batchId
    ) external nonReentrant whenNotPaused returns (uint256 totalValue) {
        _authorizeCaller();

        bytes32 proofKey = keccak256(request.zkProof.proof);
        if (usedProofs[proofKey]) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_PROOF_REPLAY, "proof replay", proofKey);
        }

        _validatePreExecution(contractId, request);
        usedProofs[proofKey] = true;

        emit ExecutionInitiated(
            contractId, batchId, request.obligations.length, msg.sender, block.timestamp
        );

        bytes32 oracleHash = oracleSnapshotHash[contractId];
        bool met = zkVerifier.verifyProof(request.zkProof, oracleHash);
        if (!met) {
            revert Layer4Errors.Layer4Error(
                Layer4Errors.ERR_ZK_VERIFICATION_FAILED, "zk failed", contractId
            );
        }

        uint256 len = request.obligations.length;
        for (uint256 i = 0; i < len; i++) {
            bytes32 idempotencyKey = keccak256(abi.encode(contractId, i, executionNonce[contractId]));
            if (executed[idempotencyKey]) {
                emit IdempotencyViolation(contractId, idempotencyKey, idempotencyKey, idempotencyKey);
                revert Layer4Errors.Layer4Error(
                    Layer4Errors.ERR_SCR_IDEMPOTENCY_VIOLATION, "already executed", idempotencyKey
                );
            }
            executed[idempotencyKey] = true;

            Layer4Types.Obligation calldata ob = request.obligations[i];
            _checkCompliance(msg.sender, ob.to, ob.value, ob.partition);

            emit ObligationTransferred(contractId, ob.partition, ob.to, ob.value, oracleHash);

            if (ob.token != address(0)) {
                _transferObligation(msg.sender, ob);
            }
            totalValue += ob.value;
        }

        executionNonce[contractId] += 1;
        executionStatus[contractId] = Layer4Types.ExecutionStatus.SETTLEMENT_PENDING;
        return totalValue;
    }

    /// @notice Gate 4.7.5 — mark pending before confirmation
    function submitExecution(bytes32 contractId, bytes32 txHash, uint256 nonce) external {
        _authorizeCaller();
        executionStatus[contractId] = Layer4Types.ExecutionStatus.SETTLEMENT_PENDING;
        executionLog[contractId] = txHash;
        emit TransactionSubmitted(contractId, txHash, nonce, 0, 0);
    }

    /// @notice Gate 4.7.1 — 12-block confirmation
    function confirmSettlement(
        bytes32 contractId,
        bytes32 txHash,
        uint256 inclusionBlock,
        uint256 currentBlock,
        uint256 gasUsed
    ) external {
        _authorizeCaller();
        if (executionStatus[contractId] != Layer4Types.ExecutionStatus.SETTLEMENT_PENDING) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_INVALID_STATE, "not pending", contractId);
        }
        if (currentBlock < inclusionBlock + CONFIRMATION_DEPTH) {
            revert Layer4Errors.Layer4Error(
                Layer4Errors.ERR_SCR_CONFIRMATION_TIMEOUT, "insufficient depth", contractId
            );
        }
        executionBlock[contractId] = inclusionBlock;
        executionStatus[contractId] = Layer4Types.ExecutionStatus.SETTLED;
        emit TransactionConfirmed(contractId, txHash, inclusionBlock, CONFIRMATION_DEPTH, gasUsed);
        emit SettlementComplete(contractId, txHash, gasUsed, 0, block.timestamp);
    }

    /// @notice Gate 4.7.3 — rollback to MONITORING semantics (off-chain FSM)
    function rollback(bytes32 contractId, bytes32 txHash, uint256 atBlock, string calldata reason) external {
        _authorizeCaller();
        bytes32 hash = keccak256(abi.encode(txHash, atBlock, reason));
        attemptHash[contractId] = hash;
        executionStatus[contractId] = Layer4Types.ExecutionStatus.ROLLED_BACK;
        emit ExecutionRolledBack(contractId, hash, reason);
    }

    function _authorizeCaller() internal view {
        if (!relayers[msg.sender] && !parties[msg.sender]) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_UNAUTHORIZED, "caller", bytes32(uint256(uint160(msg.sender))));
        }
    }

    function _validatePreExecution(bytes32 contractId, Layer4Types.ExecutionRequest calldata request) internal view {
        if (request.zkProof.proof.length == 0) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_MISSING_ZK_PROOF, "no proof", contractId);
        }

        Layer4Types.LifecycleState state = request.currentState;
        if (state != Layer4Types.LifecycleState.TRIGGERED && state != Layer4Types.LifecycleState.ARBITRATION_RESOLVED) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_INVALID_STATE, "bad state", contractId);
        }

        if (state == Layer4Types.LifecycleState.ARBITRATION_RESOLVED && !arbitrationMet[contractId]) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_ARBITRATION_DENIED, "arbitration denied", contractId);
        }

        if (
            block.timestamp < disputeDeadlines[contractId] + DISPUTE_BUFFER_SECONDS
                && !arbitrationOverrides[contractId]
        ) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_DISPUTE_WINDOW_OPEN, "dispute open", contractId);
        }

        if (request.activeChallenge || activeChallenge[contractId]) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_ACTIVE_CHALLENGE, "challenge", contractId);
        }

        bytes32 computed = keccak256(abi.encode(request.obligations));
        if (computed != registeredObligationHash[contractId]) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_OBLIGATION_TAMPERED, "hash mismatch", contractId);
        }

        if (request.oracleSnapshotHash != oracleSnapshotHash[contractId]) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_INPUT_HASH_MISMATCH, "oracle hash", contractId);
        }

        Layer4Types.ExecutionStatus status = executionStatus[contractId];
        if (status == Layer4Types.ExecutionStatus.SETTLEMENT_PENDING || status == Layer4Types.ExecutionStatus.SETTLED) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_ALREADY_EXECUTED, "already executed", contractId);
        }

        uint256 len = request.obligations.length;
        for (uint256 i = 0; i < len; i++) {
            Layer4Types.Obligation calldata ob = request.obligations[i];
            _checkCompliance(msg.sender, ob.to, ob.value, ob.partition);
        }
    }

    function _checkCompliance(address from, address to, uint256 value, bytes32 partition) internal view {
        if (!identityRegistry.isVerified(to)) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_KYC_EXPIRED, "kyc", bytes32(uint256(uint160(to))));
        }
        if (identityRegistry.isFrozen(to)) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_KYC_EXPIRED, "frozen", bytes32(uint256(uint160(to))));
        }
        if (!identityRegistry.canTransfer(from, to, value)) {
            revert Layer4Errors.Layer4Error(
                Layer4Errors.ERR_PARTITION_TRANSFER_DENIED, "3643 canTransfer", partition
            );
        }
        if (partition != bytes32(0) && !identityRegistry.canTransferByPartition(partition, from, to, value)) {
            revert Layer4Errors.Layer4Error(
                Layer4Errors.ERR_PARTITION_TRANSFER_DENIED, "partition jurisdiction", partition
            );
        }
        if (sanctionsOracle.isSanctioned(to)) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_SANCTIONED, "sanctioned", bytes32(uint256(uint160(to))));
        }
    }

    /// @notice Gate 4.3.2 / 4.5.1 — holder is msg.sender (Safe when via module)
    function _transferObligation(address holder, Layer4Types.Obligation calldata ob) internal {
        address from = holder;
        if (ob.partition != bytes32(0)) {
            if (IERC1400(ob.token).balanceOfByPartition(ob.partition, holder) < ob.value) {
                from = address(this);
            }
        } else if (IERC20(ob.token).balanceOf(holder) < ob.value) {
            from = address(this);
        }

        if (ob.partition != bytes32(0)) {
            IERC1400 token = IERC1400(ob.token);
            if (!token.canTransferByPartition(ob.partition, from, ob.to, ob.value, ob.data)) {
                revert Layer4Errors.Layer4Error(
                    Layer4Errors.ERR_PARTITION_TRANSFER_DENIED,
                    "partition transfer denied",
                    ob.partition
                );
            }
            token.transferByPartitionFrom(from, ob.partition, ob.to, ob.value, ob.data);
            return;
        }
        if (from == address(this)) {
            IERC20(ob.token).safeTransfer(ob.to, ob.value);
        } else {
            IERC20(ob.token).safeTransferFrom(from, ob.to, ob.value);
        }
    }
}
