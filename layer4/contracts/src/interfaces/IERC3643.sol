// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IERC3643 — T-REX style compliance surface (Gate 4.3.1–4.3.4)
interface IERC3643 {
    function identityRegistry() external view returns (address);

    function canTransfer(address from, address to, uint256 amount) external view returns (bool);

    function canTransferByPartition(
        bytes32 partition,
        address from,
        address to,
        uint256 amount,
        bytes calldata data
    ) external view returns (bool);
}
