// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";
import {ISanctionsOracle} from "../interfaces/ISanctionsOracle.sol";

contract MockIdentityRegistry is IIdentityRegistry {
    mapping(address => bool) public verified;
    mapping(address => bool) public frozen;

    function setVerified(address account, bool status) external {
        verified[account] = status;
    }

    function setFrozen(address account, bool status) external {
        frozen[account] = status;
    }

    function isVerified(address account) external view returns (bool) {
        return verified[account];
    }

    function isFrozen(address account) external view returns (bool) {
        return frozen[account];
    }

    function canTransfer(address from, address to, uint256) external view returns (bool) {
        return verified[from] && verified[to] && !frozen[from] && !frozen[to];
    }

    function canTransferByPartition(bytes32, address from, address to, uint256)
        external
        view
        returns (bool)
    {
        return verified[from] && verified[to] && !frozen[from] && !frozen[to];
    }
}

contract MockSanctionsOracle is ISanctionsOracle {
    mapping(address => bool) public sanctioned;

    function setSanctioned(address account, bool status) external {
        sanctioned[account] = status;
    }

    function isSanctioned(address account) external view returns (bool) {
        return sanctioned[account];
    }
}
