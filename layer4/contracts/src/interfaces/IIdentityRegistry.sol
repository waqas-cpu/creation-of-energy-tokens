// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ERC-3643 identity registry (Gate 4.3.1–4.3.3)
interface IIdentityRegistry {
    function isVerified(address account) external view returns (bool);

    function canTransfer(address from, address to, uint256 amount) external view returns (bool);

    function isFrozen(address account) external view returns (bool);

    function canTransferByPartition(bytes32 partition, address from, address to, uint256 amount)
        external
        view
        returns (bool);
}
