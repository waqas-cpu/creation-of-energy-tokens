// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Safe} from "@safe-global/safe-smart-account/contracts/Safe.sol";
import {SafeProxyFactory} from "@safe-global/safe-smart-account/contracts/proxies/SafeProxyFactory.sol";
import {SafeProxy} from "@safe-global/safe-smart-account/contracts/proxies/SafeProxy.sol";
import {SafeSignLib} from "./SafeSignLib.sol";

library SafeTestLib {
    function deploySafe(address owner, uint256 ownerPrivateKey, address moduleToEnable)
        internal
        returns (Safe safe)
    {
        address singleton = address(new Safe());
        SafeProxyFactory factory = new SafeProxyFactory();

        address[] memory owners = new address[](1);
        owners[0] = owner;

        bytes memory initializer = abi.encodeCall(
            Safe.setup,
            (owners, 1, address(0), "", address(0), address(0), 0, payable(address(0)))
        );

        SafeProxy proxy = factory.createProxyWithNonce(singleton, initializer, uint256(keccak256("layer4-safe")));
        safe = Safe(payable(address(proxy)));

        if (moduleToEnable != address(0)) {
            SafeSignLib.enableModule(safe, moduleToEnable, ownerPrivateKey);
        }
    }
}
