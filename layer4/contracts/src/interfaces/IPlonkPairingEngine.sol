// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Barretenberg UltraPlonk pairing / commitment engine (vertical decomp §12.2)
interface IPlonkPairingEngine {
    function verificationKeyHash() external view returns (bytes32);

    function verify(bytes calldata proof, bytes32[] calldata publicInputs, bytes32 vkHash)
        external
        view
        returns (bool);

    function registerVerificationKey(bytes32 vkHash, bool allowed) external;
}
