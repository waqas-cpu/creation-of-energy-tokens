// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ExecutionEngine} from "../src/ExecutionEngine.sol";
import {Layer4Types} from "../src/Layer4Types.sol";
import {Layer4Errors} from "../src/Layer4Errors.sol";
import {MockZKVerifier} from "../src/mocks/MockZKVerifier.sol";
import {MockIdentityRegistry, MockSanctionsOracle} from "../src/mocks/MockCompliance.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {MockERC1400} from "../src/mocks/MockERC1400.sol";

contract ExecutionEngineTest is Test {
    ExecutionEngine internal engine;
    MockZKVerifier internal verifier;
    MockIdentityRegistry internal identity;
    MockSanctionsOracle internal sanctions;
    ERC20Mock internal token;

    address internal relayer = address(0xBEEF);
    address internal recipient = address(0xCAFE);
    bytes32 internal contractId = keccak256("contract-1");
    bytes32 internal batchId = keccak256("batch-1");

    function setUp() public {
        vm.warp(30 days);
        verifier = new MockZKVerifier();
        identity = new MockIdentityRegistry();
        sanctions = new MockSanctionsOracle();
        engine = new ExecutionEngine(address(verifier), address(identity), address(sanctions), address(this));
        token = new ERC20Mock();

        engine.setRelayer(relayer, true);
        identity.setVerified(recipient, true);
        identity.setVerified(address(engine), true);
        identity.setVerified(relayer, true);

        Layer4Types.Obligation[] memory obs = _singleObligation(100 ether);
        engine.registerContract(contractId, keccak256(abi.encode(obs)), bytes32(uint256(1)), block.timestamp - 1 days);
    }

    function test_happy_path_execute_and_confirm() public {
        Layer4Types.ExecutionRequest memory req = _validRequest(100 ether);
        token.mint(address(engine), 100 ether);

        vm.prank(relayer);
        uint256 total = engine.executeBatch(contractId, req, batchId);
        assertEq(total, 100 ether);
        assertEq(token.balanceOf(recipient), 100 ether);

        vm.prank(relayer);
        engine.submitExecution(contractId, bytes32(uint256(1)), 1);

        vm.prank(relayer);
        engine.confirmSettlement(contractId, bytes32(uint256(1)), block.number, block.number + 12, 50_000);
        assertEq(uint256(engine.executionStatus(contractId)), uint256(Layer4Types.ExecutionStatus.SETTLED));
    }

    function test_revert_zero_zk_proof() public {
        Layer4Types.ExecutionRequest memory req = _validRequest(1 ether);
        req.zkProof.proof = "";

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                Layer4Errors.Layer4Error.selector,
                Layer4Errors.ERR_MISSING_ZK_PROOF,
                "no proof",
                contractId
            )
        );
        engine.executeBatch(contractId, req, batchId);
    }

    function test_revert_dispute_window_open() public {
        Layer4Types.Obligation[] memory obs = _singleObligation(1 ether);
        bytes32 cid = keccak256("future-dispute");
        engine.registerContract(cid, keccak256(abi.encode(obs)), bytes32(uint256(1)), block.timestamp + 1 days);

        Layer4Types.ExecutionRequest memory req = _validRequest(1 ether);
        req.obligations = obs;

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                Layer4Errors.Layer4Error.selector,
                Layer4Errors.ERR_DISPUTE_WINDOW_OPEN,
                "dispute open",
                cid
            )
        );
        engine.executeBatch(cid, req, batchId);
    }

    function test_revert_proof_replay() public {
        Layer4Types.ExecutionRequest memory req = _validRequest(100 ether);
        token.mint(address(engine), 200 ether);

        vm.startPrank(relayer);
        engine.executeBatch(contractId, req, batchId);
        vm.expectRevert(
            abi.encodeWithSelector(
                Layer4Errors.Layer4Error.selector,
                Layer4Errors.ERR_PROOF_REPLAY,
                "proof replay",
                keccak256(req.zkProof.proof)
            )
        );
        engine.executeBatch(contractId, req, batchId);
        vm.stopPrank();
    }

    function test_revert_kyc_not_verified() public {
        address bad = address(0xBAD);
        identity.setVerified(bad, false);

        Layer4Types.Obligation[] memory obs = new Layer4Types.Obligation[](1);
        obs[0] = Layer4Types.Obligation({
            token: address(token),
            partition: bytes32(0),
            to: bad,
            value: 1,
            data: "",
            reversible: true
        });
        engine.registerContract(keccak256("kyc-fail"), keccak256(abi.encode(obs)), bytes32(uint256(1)), block.timestamp - 1 days);

        Layer4Types.ExecutionRequest memory req = _validRequest(1);
        req.obligations = obs;

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                Layer4Errors.Layer4Error.selector,
                Layer4Errors.ERR_KYC_EXPIRED,
                "kyc",
                bytes32(uint256(uint160(bad)))
            )
        );
        engine.executeBatch(keccak256("kyc-fail"), req, batchId);
    }

    function test_erc1400_partition_transfer() public {
        MockERC1400 partitionToken = new MockERC1400();
        partitionToken.setTransferAllowed(true);
        bytes32 partition = keccak256("energy-kwh");

        Layer4Types.Obligation[] memory obs = new Layer4Types.Obligation[](1);
        obs[0] = Layer4Types.Obligation({
            token: address(partitionToken),
            partition: partition,
            to: recipient,
            value: 50 ether,
            data: "",
            reversible: true
        });

        bytes32 cid = keccak256("erc1400-contract");
        engine.registerContract(cid, keccak256(abi.encode(obs)), bytes32(uint256(1)), block.timestamp - 1 days);

        identity.setVerified(address(engine), true);
        identity.setVerified(relayer, true);
        partitionToken.mint(partition, address(engine), 50 ether);

        Layer4Types.ExecutionRequest memory req = _validRequest(1 ether);
        req.obligations = obs;
        req.obligationHash = keccak256(abi.encode(obs));
        req.contractId = cid;
        req.zkProof.proof = hex"02";

        vm.prank(relayer);
        engine.executeBatch(cid, req, batchId);

        assertEq(partitionToken.balanceOfByPartition(partition, recipient), 50 ether);
        assertEq(partitionToken.balanceOfByPartition(partition, address(engine)), 0);
    }

    function test_revert_partition_transfer_denied() public {
        MockERC1400 partitionToken = new MockERC1400();
        partitionToken.setTransferAllowed(false);
        bytes32 partition = keccak256("locked-partition");

        Layer4Types.Obligation[] memory obs = new Layer4Types.Obligation[](1);
        obs[0] = Layer4Types.Obligation({
            token: address(partitionToken),
            partition: partition,
            to: recipient,
            value: 1,
            data: "",
            reversible: true
        });

        bytes32 cid = keccak256("erc1400-deny");
        engine.registerContract(cid, keccak256(abi.encode(obs)), bytes32(uint256(1)), block.timestamp - 1 days);
        partitionToken.mint(partition, address(engine), 1);

        Layer4Types.ExecutionRequest memory req = _validRequest(1);
        req.obligations = obs;
        req.obligationHash = keccak256(abi.encode(obs));
        req.contractId = cid;
        req.zkProof.proof = hex"03";

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                Layer4Errors.Layer4Error.selector,
                Layer4Errors.ERR_PARTITION_TRANSFER_DENIED,
                "partition transfer denied",
                partition
            )
        );
        engine.executeBatch(cid, req, batchId);
    }

    function test_rollback_emits_event() public {
        vm.prank(relayer);
        engine.rollback(contractId, bytes32(uint256(99)), block.number, "test rollback");
        assertEq(uint256(engine.executionStatus(contractId)), uint256(Layer4Types.ExecutionStatus.ROLLED_BACK));
    }

    function _validRequest(uint256 amount) internal view returns (Layer4Types.ExecutionRequest memory) {
        return Layer4Types.ExecutionRequest({
            contractId: contractId,
            currentState: Layer4Types.LifecycleState.TRIGGERED,
            obligationHash: keccak256(abi.encode(_singleObligation(amount))),
            oracleSnapshotHash: bytes32(uint256(1)),
            zkProof: Layer4Types.ZKProof({
                proof: hex"01",
                inputHash: bytes32(uint256(1)),
                outputCommitment: verifier.MET_COMMITMENT()
            }),
            disputeDeadline: block.timestamp - 1 days,
            activeChallenge: false,
            obligations: _singleObligation(amount)
        });
    }

    function _singleObligation(uint256 amount)
        internal
        view
        returns (Layer4Types.Obligation[] memory)
    {
        Layer4Types.Obligation[] memory obs = new Layer4Types.Obligation[](1);
        obs[0] = Layer4Types.Obligation({
            token: address(token),
            partition: bytes32(0),
            to: recipient,
            value: amount,
            data: "",
            reversible: true
        });
        return obs;
    }
}
