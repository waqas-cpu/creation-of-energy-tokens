// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {UltraPlonkVerifier} from "../src/verifier/UltraPlonkVerifier.sol";
import {MockPlonkPairingEngine} from "../src/mocks/MockPlonkPairingEngine.sol";
import {Layer4Types} from "../src/Layer4Types.sol";
import {UltraPlonkProofLib} from "./helpers/UltraPlonkProofLib.sol";

contract UltraPlonkVerifierTest is Test {
    bytes32 internal constant VK = keccak256("layer4-vk");
    bytes32 internal constant MET = bytes32(uint256(1));

    MockPlonkPairingEngine internal pairing;
    UltraPlonkVerifier internal verifier;

    function setUp() public {
        pairing = new MockPlonkPairingEngine(VK);
        verifier = new UltraPlonkVerifier(address(pairing), MET);
    }

    function test_verify_valid_ultraplonk_proof() public {
        bytes32 oracle = bytes32(uint256(42));
        bytes32[] memory inputs = new bytes32[](3);
        inputs[0] = oracle;
        inputs[1] = MET;
        inputs[2] = oracle;

        bytes memory proofBytes = UltraPlonkProofLib.craft(inputs, VK);

        Layer4Types.ZKProof memory proof = Layer4Types.ZKProof({
            proof: proofBytes,
            inputHash: oracle,
            outputCommitment: MET
        });

        bool met = verifier.verifyProof(proof, oracle);
        assertTrue(met);
    }

    function test_revert_invalid_commitment() public {
        bytes32 oracle = bytes32(uint256(7));
        bytes32[] memory inputs = new bytes32[](3);
        inputs[0] = oracle;
        inputs[1] = bytes32(uint256(2));
        inputs[2] = oracle;
        bytes memory proofBytes = UltraPlonkProofLib.craft(inputs, VK);

        Layer4Types.ZKProof memory proof = Layer4Types.ZKProof({
            proof: proofBytes,
            inputHash: oracle,
            outputCommitment: bytes32(uint256(2))
        });

        vm.expectRevert();
        verifier.verifyProof(proof, oracle);
    }
}
