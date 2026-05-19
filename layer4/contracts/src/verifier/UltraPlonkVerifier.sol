// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZKVerifier} from "../interfaces/IZKVerifier.sol";
import {IPlonkPairingEngine} from "../interfaces/IPlonkPairingEngine.sol";
import {Layer4Types} from "../Layer4Types.sol";
import {Layer4Errors} from "../Layer4Errors.sol";

/// @title UltraPlonkVerifier — Gate 4.1.x on-chain Barretenberg verifier
contract UltraPlonkVerifier is IZKVerifier {
  IPlonkPairingEngine public immutable pairingEngine;
  bytes32 public immutable expectedOutputCommitment;

  constructor(address _pairingEngine, bytes32 _expectedOutputCommitment) {
    pairingEngine = IPlonkPairingEngine(_pairingEngine);
    expectedOutputCommitment = _expectedOutputCommitment;
  }

  /// @inheritdoc IZKVerifier
  function verifyProof(Layer4Types.ZKProof calldata proof, bytes32 oracleSnapshotHash)
    external
    returns (bool met)
  {
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
    if (proof.outputCommitment != expectedOutputCommitment) {
      revert Layer4Errors.Layer4Error(
        Layer4Errors.ERR_CONDITION_NOT_MET, "output commitment", proof.outputCommitment
      );
    }

    bytes32[] memory publicInputs = new bytes32[](3);
    publicInputs[0] = proof.inputHash;
    publicInputs[1] = proof.outputCommitment;
    publicInputs[2] = oracleSnapshotHash;

    met = pairingEngine.verify(
      proof.proof, publicInputs, pairingEngine.verificationKeyHash()
    );

    emit ZKProofVerified(proof.inputHash, met, block.number);

    if (!met) {
      revert Layer4Errors.Layer4Error(
        Layer4Errors.ERR_ZK_VERIFICATION_FAILED, "ultraplonk failed", proof.inputHash
      );
    }
  }
}
