// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";
import {Layer4Errors} from "../Layer4Errors.sol";

/// @title IdentityRegistry — ERC-3643 identity + transfer rules (gates 4.3.1–4.3.3)
contract IdentityRegistry is IIdentityRegistry {
    address public governance;

    mapping(address => bool) private _verified;
    mapping(address => bool) private _frozen;
    mapping(address => uint16) private _countryCode;
    mapping(bytes32 => mapping(uint16 => bool)) private _partitionCountryWhitelist;

    event IdentityRegistered(address indexed account, uint16 countryCode);
    event IdentityRevoked(address indexed account);
    event AccountFrozen(address indexed account, bool frozen);
    event PartitionCountryAllowed(bytes32 indexed partition, uint16 countryCode, bool allowed);

    modifier onlyGovernance() {
        if (msg.sender != governance) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_UNAUTHORIZED, "not governance", bytes32(0));
        }
        _;
    }

    constructor(address _governance) {
        governance = _governance;
    }

    function registerIdentity(address account, uint16 country) external onlyGovernance {
        _verified[account] = true;
        _frozen[account] = false;
        _countryCode[account] = country;
        emit IdentityRegistered(account, country);
    }

    function revokeIdentity(address account) external onlyGovernance {
        _verified[account] = false;
        emit IdentityRevoked(account);
    }

    function setFrozen(address account, bool frozen) external onlyGovernance {
        _frozen[account] = frozen;
        emit AccountFrozen(account, frozen);
    }

    function setPartitionCountry(bytes32 partition, uint16 country, bool allowed) external onlyGovernance {
        _partitionCountryWhitelist[partition][country] = allowed;
        emit PartitionCountryAllowed(partition, country, allowed);
    }

    function isVerified(address account) external view returns (bool) {
        return _verified[account];
    }

    function isFrozen(address account) external view returns (bool) {
        return _frozen[account];
    }

    function countryCode(address account) external view returns (uint16) {
        return _countryCode[account];
    }

    function isPartitionCountryAllowed(bytes32 partition, uint16 country) external view returns (bool) {
        return _partitionCountryWhitelist[partition][country];
    }

    function canTransfer(address from, address to, uint256) external view returns (bool) {
        if (!_verified[from] || !_verified[to]) return false;
        if (_frozen[from] || _frozen[to]) return false;
        return true;
    }

    function canTransferByPartition(bytes32 partition, address from, address to, uint256)
        external
        view
        returns (bool)
    {
        if (!this.canTransfer(from, to, 0)) return false;
        uint16 toCountry = _countryCode[to];
        return _partitionCountryWhitelist[partition][toCountry];
    }
}
