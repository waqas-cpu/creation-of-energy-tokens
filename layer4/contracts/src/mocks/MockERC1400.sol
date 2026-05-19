// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC1400} from "../interfaces/IERC1400.sol";

/// @dev Test double for ERC-1400 partition transfers (gate 4.3.2 / 4.5.1)
contract MockERC1400 is IERC1400 {
    mapping(bytes32 => mapping(address => uint256)) internal _balances;
    bool public transfersEnabled;

    function mint(bytes32 partition, address to, uint256 amount) external {
        _balances[partition][to] += amount;
    }

    function setTransferAllowed(bool allowed) external {
        transfersEnabled = allowed;
    }

    function balanceOfByPartition(bytes32 partition, address account) external view returns (uint256) {
        return _balances[partition][account];
    }

    function canTransferByPartition(
        bytes32 partition,
        address from,
        address to,
        uint256 value,
        bytes calldata
    ) external view returns (bool) {
        if (!transfersEnabled) return false;
        if (to == address(0)) return false;
        return _balances[partition][from] >= value;
    }

    function transferByPartition(bytes32 partition, address to, uint256 value, bytes calldata data)
        external
        returns (bytes32)
    {
        return transferByPartitionFrom(msg.sender, partition, to, value, data);
    }

    function transferByPartitionFrom(
        address from,
        bytes32 partition,
        address to,
        uint256 value,
        bytes calldata
    ) public returns (bytes32) {
        require(transfersEnabled, "MockERC1400: transfers disabled");
        require(_balances[partition][from] >= value, "MockERC1400: insufficient balance");
        _balances[partition][from] -= value;
        _balances[partition][to] += value;
        return keccak256(abi.encodePacked(partition, from, to, value, block.timestamp));
    }
}
