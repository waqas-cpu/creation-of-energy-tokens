// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPlonkPairingEngine} from "../interfaces/IPlonkPairingEngine.sol";

/// @dev Test double — accepts correctly bound UltraPlonk proofs without pairing precompile
contract MockPlonkPairingEngine is IPlonkPairingEngine {
    function _readWord(bytes memory proof, uint256 offset) private pure returns (bytes32 word) {
        assembly {
            word := mload(add(add(proof, 32), offset))
        }
    }

    bytes32 public immutable verificationKeyHash;

    constructor(bytes32 vkHash) {
        verificationKeyHash = vkHash;
    }

    function registerVerificationKey(bytes32, bool) external pure {}

    function verify(bytes calldata proof, bytes32[] calldata publicInputs, bytes32 vkHash)
        external
        view
        returns (bool)
    {
        if (proof.length != 2144 || proof[0] != 0x01) return false;
        if (vkHash != verificationKeyHash) return false;
        if (publicInputs.length < 3) return false;

        bytes32 pubHash = keccak256(abi.encodePacked(publicInputs));
        bytes32 commitment = _readWord(proof, 1);
        bytes32 binding = keccak256(abi.encodePacked(pubHash, vkHash, commitment));
        return _readWord(proof, 33) == binding;
    }
}
