// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ExecutionEngine} from "../ExecutionEngine.sol";
import {Layer4Types} from "../Layer4Types.sol";
import {Layer4Errors} from "../Layer4Errors.sol";
import {IZKVerifier} from "../interfaces/IZKVerifier.sol";
import {ISafe} from "../interfaces/ISafe.sol";

/// @title ExecutionModule — Safe v1.4 module (gates 4.6.5, vertical decomp §12.5)
/// @dev ZK proof MUST pass before `execTransactionFromModule` calls ExecutionEngine.
contract ExecutionModule {
    uint256 public constant EXECUTION_EXPIRY_SECONDS = 48 hours;

    ISafe public immutable safe;
    ExecutionEngine public immutable engine;
    IZKVerifier public immutable zkVerifier;

    mapping(bytes32 => uint256) public executionDeadline;

    event ModuleExecutionInitiated(bytes32 indexed contractId, bytes32 indexed batchId, address indexed caller);
    event ModuleExecutionComplete(bytes32 indexed contractId, bytes32 indexed batchId, bool success);

    constructor(address _safe, address _engine, address _zkVerifier) {
        if (_safe == address(0) || _engine == address(0) || _zkVerifier == address(0)) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_TB_INVALID_CALLDATA, "zero addr", bytes32(0));
        }
        safe = ISafe(_safe);
        engine = ExecutionEngine(_engine);
        zkVerifier = IZKVerifier(_zkVerifier);
    }

    /// @notice Gate 4.6.5 — verify ZK then execute engine via Safe module path
    function executeBatchViaSafe(
        bytes32 contractId,
        Layer4Types.ExecutionRequest calldata request,
        bytes32 batchId
    ) external returns (bool success) {
        if (!safe.isModuleEnabled(address(this))) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_UNAUTHORIZED, "module disabled", contractId);
        }

        uint256 deadline = executionDeadline[contractId];
        if (deadline != 0 && block.timestamp > deadline) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_INVALID_STATE, "execution expired", contractId);
        }

        emit ModuleExecutionInitiated(contractId, batchId, msg.sender);

        zkVerifier.verifyProof(request.zkProof, request.oracleSnapshotHash);

        bytes memory data = abi.encodeCall(ExecutionEngine.executeBatch, (contractId, request, batchId));

        success = safe.execTransactionFromModule(
            address(engine), 0, data, ISafe.Operation.Call
        );

        if (!success) {
            revert Layer4Errors.Layer4Error(
                Layer4Errors.ERR_SCR_REVERT_DETECTED, "Safe module exec failed", contractId
            );
        }

        emit ModuleExecutionComplete(contractId, batchId, true);
    }

    function setExecutionDeadline(bytes32 contractId, uint256 triggeredAt) external {
        require(msg.sender == address(engine) || msg.sender == address(safe), "unauthorized");
        executionDeadline[contractId] = triggeredAt + EXECUTION_EXPIRY_SECONDS;
    }
}
