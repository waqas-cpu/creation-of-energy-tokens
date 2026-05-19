// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Safe} from "@safe-global/safe-smart-account/contracts/Safe.sol";
import {ExecutionEngine} from "../src/ExecutionEngine.sol";
import {ExecutionModule} from "../src/modules/ExecutionModule.sol";
import {Layer4Types} from "../src/Layer4Types.sol";
import {MockZKVerifier} from "../src/mocks/MockZKVerifier.sol";
import {MockIdentityRegistry, MockSanctionsOracle} from "../src/mocks/MockCompliance.sol";
import {MockERC1400} from "../src/mocks/MockERC1400.sol";
import {SafeTestLib} from "./helpers/SafeTestLib.sol";
import {SafeSignLib} from "./helpers/SafeSignLib.sol";

contract ExecutionModuleTest is Test {
    uint256 internal ownerPk = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address internal owner;
    address internal recipient = address(0xCAFE);

    Safe internal safe;
    ExecutionEngine internal engine;
    ExecutionModule internal module;
    MockZKVerifier internal verifier;
    MockIdentityRegistry internal identity;
    MockSanctionsOracle internal sanctions;
    MockERC1400 internal token;

    bytes32 internal contractId = keccak256("safe-module-contract");
    bytes32 internal batchId = keccak256("batch-safe");
    bytes32 internal partition = keccak256("kwh");

    function setUp() public {
        owner = vm.addr(ownerPk);
        vm.warp(30 days);
        verifier = new MockZKVerifier();
        identity = new MockIdentityRegistry();
        sanctions = new MockSanctionsOracle();
        engine = new ExecutionEngine(address(verifier), address(identity), address(sanctions), owner);
        safe = SafeTestLib.deploySafe(owner, ownerPk, address(0));
        module = new ExecutionModule(address(safe), address(engine), address(verifier));
        SafeSignLib.enableModule(safe, address(module), ownerPk);

        token = new MockERC1400();
        token.setTransferAllowed(true);

        identity.setVerified(address(safe), true);
        identity.setVerified(recipient, true);

        Layer4Types.Obligation[] memory obs = _obligations(10 ether);
        vm.startPrank(owner);
        engine.registerContract(contractId, keccak256(abi.encode(obs)), bytes32(uint256(1)), block.timestamp - 1 days);
        engine.setParty(address(safe), true);
        vm.stopPrank();
        token.mint(partition, address(safe), 10 ether);
    }

    function test_executeBatchViaSafe_transfers_from_safe() public {
        Layer4Types.Obligation[] memory obs = _obligations(10 ether);
        Layer4Types.ExecutionRequest memory req = Layer4Types.ExecutionRequest({
            contractId: contractId,
            currentState: Layer4Types.LifecycleState.TRIGGERED,
            obligationHash: keccak256(abi.encode(obs)),
            oracleSnapshotHash: bytes32(uint256(1)),
            zkProof: Layer4Types.ZKProof({
                proof: hex"05",
                inputHash: bytes32(uint256(1)),
                outputCommitment: verifier.MET_COMMITMENT()
            }),
            disputeDeadline: block.timestamp - 1 days,
            activeChallenge: false,
            obligations: obs
        });

        module.executeBatchViaSafe(contractId, req, batchId);
        assertEq(token.balanceOfByPartition(partition, recipient), 10 ether);
    }

    function _obligations(uint256 amount) internal view returns (Layer4Types.Obligation[] memory) {
        Layer4Types.Obligation[] memory obs = new Layer4Types.Obligation[](1);
        obs[0] = Layer4Types.Obligation({
            token: address(token),
            partition: partition,
            to: recipient,
            value: amount,
            data: "",
            reversible: true
        });
        return obs;
    }
}
