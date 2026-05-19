// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal Safe v1.4 surface for ExecutionModule
interface ISafe {
    enum Operation {
        Call,
        DelegateCall
    }

    function execTransactionFromModule(address to, uint256 value, bytes memory data, Operation operation)
        external
        returns (bool success);

    function isModuleEnabled(address module) external view returns (bool);

    function enableModule(address module) external;

    function nonce() external view returns (uint256);

    function getThreshold() external view returns (uint256);

    function getOwners() external view returns (address[] memory);
}
