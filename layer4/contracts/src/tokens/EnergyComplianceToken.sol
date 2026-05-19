// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC1400} from "../interfaces/IERC1400.sol";
import {IERC3643} from "../interfaces/IERC3643.sol";
import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";
import {Layer4Errors} from "../Layer4Errors.sol";

/// @title EnergyComplianceToken — ERC-1400 partitions + ERC-3643 hooks (gates 4.3.2, 4.5.1)
contract EnergyComplianceToken is IERC1400, IERC3643 {
    IIdentityRegistry public immutable registry;
    address public governance;

    mapping(bytes32 => mapping(address => uint256)) private _balances;
    bool public transfersEnabled;

    event TransferByPartition(
        bytes32 indexed partition, address indexed operator, address indexed from, address to, uint256 value
    );

    modifier onlyGovernance() {
        if (msg.sender != governance) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_UNAUTHORIZED, "not governance", bytes32(0));
        }
        _;
    }

    constructor(address _identityRegistry, address _governance) {
        registry = IIdentityRegistry(_identityRegistry);
        governance = _governance;
        transfersEnabled = true;
    }

    function identityRegistry() external view returns (address) {
        return address(registry);
    }

    function setTransfersEnabled(bool enabled) external onlyGovernance {
        transfersEnabled = enabled;
    }

    function mint(bytes32 partition, address to, uint256 amount) external onlyGovernance {
        _balances[partition][to] += amount;
    }

    function balanceOfByPartition(bytes32 partition, address account) external view returns (uint256) {
        return _balances[partition][account];
    }

    function canTransfer(address from, address to, uint256 amount) public view returns (bool) {
        if (!transfersEnabled) return false;
        return registry.canTransfer(from, to, amount);
    }

    function canTransferByPartition(bytes32 partition, address from, address to, uint256 value, bytes calldata)
        public
        view
        override(IERC1400, IERC3643)
        returns (bool)
    {
        if (!transfersEnabled) return false;
        if (_balances[partition][from] < value) return false;
        return registry.canTransferByPartition(partition, from, to, value);
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
        bytes calldata data
    ) public returns (bytes32) {
        if (!canTransferByPartition(partition, from, to, value, data)) {
            revert Layer4Errors.Layer4Error(
                Layer4Errors.ERR_PARTITION_TRANSFER_DENIED,
                "3643 hook rejected",
                partition
            );
        }
        _balances[partition][from] -= value;
        _balances[partition][to] += value;
        emit TransferByPartition(partition, msg.sender, from, to, value);
        return keccak256(abi.encodePacked(partition, from, to, value, block.timestamp));
    }
}
