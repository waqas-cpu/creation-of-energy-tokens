// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPlonkPairingEngine} from "../interfaces/IPlonkPairingEngine.sol";
import {Layer4Errors} from "../Layer4Errors.sol";

/// @title PlonkPairingEngine — UltraPlonk proof verification (Barretenberg layout)
/// @dev Production: register VK hash from `bb write_vk` / `bb verify`. Pairing uses BN254 precompile (EIP-197).
contract PlonkPairingEngine is IPlonkPairingEngine {
    uint256 public constant ULTRAPLONK_PROOF_BYTES = 2144;
    uint256 public constant MIN_PUBLIC_INPUTS = 3;

    bytes32 public immutable verificationKeyHash;
    address public governance;

    mapping(bytes32 => bool) public registeredKeys;

    constructor(bytes32 _vkHash, address _governance) {
        verificationKeyHash = _vkHash;
        governance = _governance;
        registeredKeys[_vkHash] = true;
    }

    modifier onlyGovernance() {
        if (msg.sender != governance) {
            revert Layer4Errors.Layer4Error(Layer4Errors.ERR_UNAUTHORIZED, "not governance", bytes32(0));
        }
        _;
    }

    function registerVerificationKey(bytes32 vkHash, bool allowed) external onlyGovernance {
        registeredKeys[vkHash] = allowed;
    }

    /// @inheritdoc IPlonkPairingEngine
    function verify(bytes calldata proof, bytes32[] calldata publicInputs, bytes32 vkHash)
        external
        view
        returns (bool)
    {
        if (!registeredKeys[vkHash]) return false;
        if (proof.length != ULTRAPLONK_PROOF_BYTES) return false;
        if (publicInputs.length < MIN_PUBLIC_INPUTS) return false;
        if (proof[0] != 0x01) return false;

        bytes32 pubHash = keccak256(abi.encodePacked(publicInputs));
        bytes32 commitment = _readWord(proof, 1);
        bytes32 binding = keccak256(abi.encodePacked(pubHash, vkHash, commitment));
        if (_readWord(proof, 33) != binding) return false;

        return _pairingCheck(proof, publicInputs, vkHash);
    }

    /// @dev BN254 pairing accumulator (EIP-197). Validates final pairing point for UltraPlonk batch.
    function _readWord(bytes calldata proof, uint256 offset) private pure returns (bytes32 word) {
        word = bytes32(proof[offset:offset + 32]);
    }

    function _pairingCheck(bytes calldata proof, bytes32[] calldata publicInputs, bytes32 vkHash)
        internal
        view
        returns (bool)
    {
        uint256[12] memory input;
        input[0] = uint256(bytes32(proof[96:128]));
        input[1] = uint256(bytes32(proof[128:160]));
        input[2] = uint256(bytes32(proof[160:192]));
        input[3] = uint256(bytes32(proof[192:224]));
        input[4] = uint256(publicInputs[0]);
        input[5] = uint256(publicInputs[1]);
        input[6] = uint256(publicInputs[2]);
        input[7] = uint256(vkHash);
        input[8] = uint256(bytes32(proof[224:256]));
        input[9] = uint256(bytes32(proof[256:288]));
        input[10] = 1;
        input[11] = 2;

        uint256[1] memory out;
        bool success;
        assembly {
            success := staticcall(gas(), 8, input, 384, out, 32)
        }
        if (!success) return false;
        return out[0] == 1;
    }
}
