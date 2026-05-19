// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZKVerifier} from "../interfaces/IZKVerifier.sol";
import {Layer4Types} from "../Layer4Types.sol";
import {Layer4Errors} from "../Layer4Errors.sol";

/// @dev Testnet verifier — production uses Barretenberg UltraPlonk (vertical decomp §12.2)
contract MockZKVerifier is IZKVerifier {
    bytes32 public constant MET_COMMITMENT = bytes32(uint256(1));

    function verifyProof(
        Layer4Types.ZKProof calldata proof,
        bytes32 oracleSnapshotHash
    ) external returns (bool met) {
        if (proof.proof.length == 0) {
            revert Layer4Errors.Layer4Error(
                Layer4Errors.ERR_MISSING_ZK_PROOF, "missing proof", oracleSnapshotHash
            );
        }
        if (proof.inputHash != oracleSnapshotHash) {
            revert Layer4Errors.Layer4Error(
                Layer4Errors.ERR_INPUT_HASH_MISMATCH, "input hash mismatch", proof.inputHash
            );
        }
        met = proof.outputCommitment == MET_COMMITMENT;
        emit ZKProofVerified(proof.inputHash, met, block.number);
        if (!met) {
            revert Layer4Errors.Layer4Error(
                Layer4Errors.ERR_CONDITION_NOT_MET, "condition not met", proof.outputCommitment
            );
        }
    }
}
