// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Safe} from "@safe-global/safe-smart-account/contracts/Safe.sol";
import {Enum} from "@safe-global/safe-smart-account/contracts/common/Enum.sol";
import {Vm} from "forge-std/Vm.sol";

library SafeSignLib {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function enableModule(Safe safe, address module, uint256 ownerPrivateKey) internal {
        bytes memory data = abi.encodeWithSignature("enableModule(address)", module);
        execSingleOwner(safe, address(safe), 0, data, ownerPrivateKey);
    }

    function execSingleOwner(Safe safe, address to, uint256 value, bytes memory data, uint256 ownerPrivateKey)
        internal
    {
        uint256 nonce = safe.nonce();
        bytes32 txHash = safe.getTransactionHash(
            to, value, data, Enum.Operation.Call, 0, 0, 0, address(0), address(0), nonce
        );
        (uint8 v, bytes32 r, bytes32 s) = VM.sign(ownerPrivateKey, txHash);
        if (v < 27) v += 27;
        bytes memory signatures = abi.encodePacked(r, s, v);
        require(
            safe.execTransaction(
                to, value, data, Enum.Operation.Call, 0, 0, 0, address(0), payable(0), signatures
            ),
            "Safe exec failed"
        );
    }
}
