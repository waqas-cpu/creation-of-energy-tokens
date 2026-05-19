// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Crafts bound UltraPlonk-format proofs for MockPlonkPairingEngine / test verifier
library UltraPlonkProofLib {
    uint256 internal constant PROOF_BYTES = 2144;

    function craft(bytes32[] memory publicInputs, bytes32 vkHash) internal pure returns (bytes memory proof) {
        bytes32 commitment = keccak256(abi.encodePacked("layer4-commitment", vkHash));
        bytes32 pubHash = keccak256(abi.encodePacked(publicInputs));
        bytes32 binding = keccak256(abi.encodePacked(pubHash, vkHash, commitment));

        proof = bytes.concat(bytes1(0x01), commitment, binding, new bytes(PROOF_BYTES - 65));
    }
}
