// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ArcBountyBoard.sol";
import "./mocks/MockERC20.sol";
import "./mocks/MockIdentityRegistry.sol";

interface Vm {
    function warp(uint256 newTimestamp) external;
}

contract Actor {
    function execute(address target, bytes calldata data) external returns (bool success, bytes memory result) {
        (success, result) = target.call(data);
    }
}

contract ArcBountyBoardTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ArcBountyBoard private board;
    MockERC20 private stablecoin;
    MockIdentityRegistry private identityRegistry;
    Actor private sponsor;
    Actor private claimant;

    uint256 private constant PAYOUT = 25_000_000;
    uint256 private constant AGENT_ID = 101;

    function setUp() public {
        stablecoin = new MockERC20();
        identityRegistry = new MockIdentityRegistry();
        board = new ArcBountyBoard(address(stablecoin), address(identityRegistry));

        sponsor = new Actor();
        claimant = new Actor();

        stablecoin.mint(address(sponsor), 100_000_000);
        identityRegistry.setOwner(AGENT_ID, address(claimant));
    }

    function testCreateClaimSubmitApproveFlow() public {
        setUp();

        _mustSucceed(
            sponsor.execute(
                address(stablecoin),
                abi.encodeWithSignature("approve(address,uint256)", address(board), PAYOUT)
            )
        );

        _mustSucceed(
            sponsor.execute(
                address(board),
                abi.encodeWithSignature(
                    "createBounty(string,uint128,uint32,uint32,uint32)",
                    "ipfs://bounty-1",
                    uint128(PAYOUT),
                    uint32(1 days),
                    uint32(2 days),
                    uint32(1 days)
                )
            )
        );

        _mustSucceed(
            claimant.execute(
                address(board),
                abi.encodeWithSignature("claimBounty(uint256,uint256)", 0, AGENT_ID)
            )
        );

        _mustSucceed(
            claimant.execute(
                address(board),
                abi.encodeWithSignature("submitResult(uint256,string)", 0, "ipfs://result-1")
            )
        );

        _mustSucceed(
            sponsor.execute(address(board), abi.encodeWithSignature("approveBounty(uint256)", 0))
        );

        assert(stablecoin.balanceOf(address(claimant)) == PAYOUT);
    }

    function testClaimFailsForNonOwner() public {
        setUp();

        _mustSucceed(
            sponsor.execute(
                address(stablecoin),
                abi.encodeWithSignature("approve(address,uint256)", address(board), PAYOUT)
            )
        );

        _mustSucceed(
            sponsor.execute(
                address(board),
                abi.encodeWithSignature(
                    "createBounty(string,uint128,uint32,uint32,uint32)",
                    "ipfs://bounty-2",
                    uint128(PAYOUT),
                    uint32(1 days),
                    uint32(2 days),
                    uint32(1 days)
                )
            )
        );

        identityRegistry.setOwner(AGENT_ID, address(sponsor));

        (bool success,) = claimant.execute(
            address(board),
            abi.encodeWithSignature("claimBounty(uint256,uint256)", 0, AGENT_ID)
        );

        assert(!success);
    }

    function testCancelAfterClaimDeadline() public {
        setUp();

        _mustSucceed(
            sponsor.execute(
                address(stablecoin),
                abi.encodeWithSignature("approve(address,uint256)", address(board), PAYOUT)
            )
        );

        _mustSucceed(
            sponsor.execute(
                address(board),
                abi.encodeWithSignature(
                    "createBounty(string,uint128,uint32,uint32,uint32)",
                    "ipfs://bounty-3",
                    uint128(PAYOUT),
                    uint32(1),
                    uint32(2 days),
                    uint32(1 days)
                )
            )
        );

        vm.warp(block.timestamp + 2);

        _mustSucceed(
            sponsor.execute(address(board), abi.encodeWithSignature("cancelUnclaimedBounty(uint256)", 0))
        );

        assert(stablecoin.balanceOf(address(sponsor)) == 100_000_000);
    }

    function testCreatorCanUpdateOpenBounty() public {
        setUp();

        _mustSucceed(
            sponsor.execute(
                address(stablecoin),
                abi.encodeWithSignature("approve(address,uint256)", address(board), 100_000_000)
            )
        );

        _mustSucceed(
            sponsor.execute(
                address(board),
                abi.encodeWithSignature(
                    "createBounty(string,uint128,uint32,uint32,uint32)",
                    "ipfs://bounty-edit-1",
                    uint128(PAYOUT),
                    uint32(1 days),
                    uint32(2 days),
                    uint32(1 days)
                )
            )
        );

        uint256 updatedPayout = 10_000_000;

        _mustSucceed(
            sponsor.execute(
                address(board),
                abi.encodeWithSignature(
                    "updateBounty(uint256,string,uint128,uint32,uint32,uint32)",
                    0,
                    "ipfs://bounty-edit-2",
                    uint128(updatedPayout),
                    uint32(3 days),
                    uint32(1 days),
                    uint32(2 days)
                )
            )
        );

        ArcBountyBoard.Bounty memory bounty = board.getBounty(0);
        assert(bounty.payoutAmount == updatedPayout);
        assert(keccak256(bytes(bounty.metadataURI)) == keccak256(bytes("ipfs://bounty-edit-2")));
        assert(stablecoin.balanceOf(address(sponsor)) == 100_000_000 - updatedPayout);
    }

    function testParticipantsCanPostMessages() public {
        setUp();

        _mustSucceed(
            sponsor.execute(
                address(stablecoin),
                abi.encodeWithSignature("approve(address,uint256)", address(board), PAYOUT)
            )
        );

        _mustSucceed(
            sponsor.execute(
                address(board),
                abi.encodeWithSignature(
                    "createBounty(string,uint128,uint32,uint32,uint32)",
                    "ipfs://bounty-chat-1",
                    uint128(PAYOUT),
                    uint32(1 days),
                    uint32(2 days),
                    uint32(1 days)
                )
            )
        );

        _mustSucceed(
            claimant.execute(
                address(board),
                abi.encodeWithSignature("claimBounty(uint256,uint256)", 0, AGENT_ID)
            )
        );

        _mustSucceed(
            sponsor.execute(
                address(board),
                abi.encodeWithSignature("postBountyMessage(uint256,string)", 0, "ipfs://message-1")
            )
        );

        _mustSucceed(
            claimant.execute(
                address(board),
                abi.encodeWithSignature("postBountyMessage(uint256,string)", 0, "ipfs://message-2")
            )
        );
    }

    function _mustSucceed(bool success, bytes memory) private pure {
        assert(success);
    }
}
