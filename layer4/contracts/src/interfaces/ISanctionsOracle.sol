// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Sanctions screening oracle (Gate 4.3.4)
interface ISanctionsOracle {
  function isSanctioned(address account) external view returns (bool);
}
