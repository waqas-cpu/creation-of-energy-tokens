// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Layer4Types} from "../Layer4Types.sol";

interface IZKVerifier {
  function verifyProof(
    Layer4Types.ZKProof calldata proof,
    bytes32 oracleSnapshotHash
  ) external returns (bool met);

  event ZKProofVerified(bytes32 indexed executionId, bool result, uint256 blockNumber);
}
