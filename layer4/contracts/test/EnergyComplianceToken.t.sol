// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {EnergyComplianceToken} from "../src/tokens/EnergyComplianceToken.sol";
import {IdentityRegistry} from "../src/compliance/IdentityRegistry.sol";
import {Layer4Errors} from "../src/Layer4Errors.sol";

contract EnergyComplianceTokenTest is Test {
    IdentityRegistry internal registry;
    EnergyComplianceToken internal token;
    bytes32 internal partition = keccak256("us-kwh");

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        registry = new IdentityRegistry(address(this));
        token = new EnergyComplianceToken(address(registry), address(this));
        registry.registerIdentity(alice, 840);
        registry.registerIdentity(bob, 840);
        registry.setPartitionCountry(partition, 840, true);
        token.mint(partition, alice, 100 ether);
    }

    function test_transfer_with_3643_hooks() public {
        vm.prank(alice);
        token.transferByPartition(partition, bob, 25 ether, "");
        assertEq(token.balanceOfByPartition(partition, bob), 25 ether);
    }

    function test_revert_unverified_recipient() public {
        address unknown = address(0xDEAD);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                Layer4Errors.Layer4Error.selector,
                Layer4Errors.ERR_PARTITION_TRANSFER_DENIED,
                "3643 hook rejected",
                partition
            )
        );
        token.transferByPartition(partition, unknown, 1, "");
    }
}
