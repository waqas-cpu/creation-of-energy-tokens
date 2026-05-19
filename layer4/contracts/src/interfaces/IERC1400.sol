// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IERC1400 — minimal partition transfer surface (integration gates §4.3.2, §4.5.1)
interface IERC1400 {
    function transferByPartition(bytes32 partition, address to, uint256 value, bytes calldata data)
        external
        returns (bytes32);

    function transferByPartitionFrom(
        address from,
        bytes32 partition,
        address to,
        uint256 value,
        bytes calldata data
    ) external returns (bytes32);

    function balanceOfByPartition(bytes32 partition, address account) external view returns (uint256);

    function canTransferByPartition(
        bytes32 partition,
        address from,
        address to,
        uint256 value,
        bytes calldata data
    ) external view returns (bool);
}
