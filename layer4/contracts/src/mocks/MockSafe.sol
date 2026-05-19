// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal Safe{Core} surface for AUTH lane tests (gates 4.6.1, 4.5.5)
contract MockSafe {
    address[] private _owners;
    uint256 private _threshold;
    uint256 private _nonce;

    constructor(address[] memory owners, uint256 threshold) {
        require(threshold > 0 && threshold <= owners.length, "MockSafe: bad threshold");
        _owners = owners;
        _threshold = threshold;
        _nonce = 0;
    }

    function getOwners() external view returns (address[] memory) {
        return _owners;
    }

    function getThreshold() external view returns (uint256) {
        return _threshold;
    }

    function nonce() external view returns (uint256) {
        return _nonce;
    }

    /// @notice Alias for Safe SDK compatibility (gate 4.5.5)
    function getNonce() external view returns (uint256) {
        return _nonce;
    }

    function isOwner(address account) external view returns (bool) {
        uint256 len = _owners.length;
        for (uint256 i = 0; i < len; i++) {
            if (_owners[i] == account) return true;
        }
        return false;
    }

    function incrementNonce() external {
        _nonce += 1;
    }
}
