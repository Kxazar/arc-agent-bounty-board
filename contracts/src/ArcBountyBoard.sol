// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract ArcBountyBoard {
    enum Status {
        Open,
        Claimed,
        Submitted,
        RevisionRequested,
        Approved,
        Disputed,
        Cancelled
    }

    struct Bounty {
        address creator;
        address claimant;
        address disputeRaisedBy;
        uint256 agentId;
        uint128 payoutAmount;
        uint128 remainingAmount;
        uint64 claimDeadline;
        uint64 submissionDeadline;
        uint64 reviewDeadline;
        uint32 submissionWindow;
        uint32 reviewWindow;
        uint8 milestoneCount;
        uint8 releasedMilestones;
        uint128[3] milestoneAmounts;
        Status status;
        string metadataURI;
        string resultURI;
        string reviewURI;
        string disputeURI;
    }

    error InvalidAddress();
    error InvalidAmount();
    error InvalidDuration();
    error EmptyURI();
    error BountyNotFound();
    error BountyNotOpen();
    error BountyNotClaimed();
    error BountyNotSubmitted();
    error BountyNotResubmittable();
    error BountyNotDisputable();
    error DeadlineExpired();
    error DeadlineNotReached();
    error NotCreator();
    error NotClaimant();
    error NotParticipant();
    error InvalidAgentId();
    error InvalidAgentOwner();
    error InvalidMilestonePlan();
    error AlreadyClaimed();
    error TransferFailed();

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed creator,
        uint256 payoutAmount,
        uint64 claimDeadline,
        uint8 milestoneCount,
        string metadataURI
    );
    event BountyClaimed(
        uint256 indexed bountyId,
        address indexed claimant,
        uint256 indexed agentId,
        uint64 submissionDeadline
    );
    event ResultSubmitted(
        uint256 indexed bountyId,
        address indexed claimant,
        uint64 reviewDeadline,
        string resultURI
    );
    event BountyRevisionRequested(
        uint256 indexed bountyId,
        address indexed creator,
        uint64 submissionDeadline,
        string reviewURI
    );
    event BountyUpdated(
        uint256 indexed bountyId,
        uint256 payoutAmount,
        uint64 claimDeadline,
        uint8 milestoneCount,
        string metadataURI
    );
    event MilestoneReleased(
        uint256 indexed bountyId,
        address indexed claimant,
        uint8 milestoneNumber,
        uint256 milestoneAmount,
        uint256 remainingAmount,
        string reviewURI
    );
    event BountyApproved(
        uint256 indexed bountyId,
        address indexed claimant,
        uint256 releasedAmount,
        string reviewURI
    );
    event BountyDisputed(uint256 indexed bountyId, address indexed raisedBy, string disputeURI);
    event BountyCancelled(uint256 indexed bountyId, address indexed creator);
    event BountyMessagePosted(
        uint256 indexed bountyId,
        address indexed author,
        uint64 timestamp,
        string messageURI
    );

    address public immutable stablecoin;
    address public immutable identityRegistry;
    uint256 public nextBountyId;

    mapping(uint256 => Bounty) private _bounties;

    constructor(address stablecoin_, address identityRegistry_) {
        if (stablecoin_ == address(0) || identityRegistry_ == address(0)) revert InvalidAddress();
        stablecoin = stablecoin_;
        identityRegistry = identityRegistry_;
    }

    function createBounty(
        string calldata metadataURI,
        uint128 payoutAmount,
        uint32 claimWindow,
        uint32 submissionWindow,
        uint32 reviewWindow,
        uint128[3] calldata milestoneAmounts,
        uint8 milestoneCount
    ) external returns (uint256 bountyId) {
        if (bytes(metadataURI).length == 0) revert EmptyURI();
        if (payoutAmount == 0) revert InvalidAmount();
        if (claimWindow == 0 || submissionWindow == 0 || reviewWindow == 0) revert InvalidDuration();

        bountyId = nextBountyId++;

        Bounty storage bounty = _bounties[bountyId];
        bounty.creator = msg.sender;
        bounty.payoutAmount = payoutAmount;
        bounty.claimDeadline = uint64(block.timestamp + claimWindow);
        bounty.submissionWindow = submissionWindow;
        bounty.reviewWindow = reviewWindow;
        bounty.status = Status.Open;
        bounty.metadataURI = metadataURI;
        _configureMilestones(bounty, payoutAmount, milestoneAmounts, milestoneCount);

        _safeTransferFrom(stablecoin, msg.sender, address(this), payoutAmount);

        emit BountyCreated(
            bountyId,
            msg.sender,
            payoutAmount,
            bounty.claimDeadline,
            bounty.milestoneCount,
            metadataURI
        );
    }

    function claimBounty(uint256 bountyId, uint256 agentId) external {
        Bounty storage bounty = _getBounty(bountyId);
        address agentOwner;

        if (bounty.status != Status.Open) revert BountyNotOpen();
        if (block.timestamp > bounty.claimDeadline) revert DeadlineExpired();
        if (bounty.claimant != address(0)) revert AlreadyClaimed();

        try IAgentIdentityRegistry(identityRegistry).ownerOf(agentId) returns (address owner) {
            agentOwner = owner;
        } catch {
            revert InvalidAgentId();
        }

        if (agentOwner != msg.sender) revert InvalidAgentOwner();

        bounty.claimant = msg.sender;
        bounty.agentId = agentId;
        bounty.submissionDeadline = uint64(block.timestamp + bounty.submissionWindow);
        bounty.status = Status.Claimed;

        emit BountyClaimed(bountyId, msg.sender, agentId, bounty.submissionDeadline);
    }

    function updateBounty(
        uint256 bountyId,
        string calldata metadataURI,
        uint128 payoutAmount,
        uint32 claimWindow,
        uint32 submissionWindow,
        uint32 reviewWindow,
        uint128[3] calldata milestoneAmounts,
        uint8 milestoneCount
    ) external {
        Bounty storage bounty = _getBounty(bountyId);
        uint256 previousPayout = bounty.payoutAmount;

        if (msg.sender != bounty.creator) revert NotCreator();
        if (bounty.status != Status.Open) revert BountyNotOpen();
        if (bytes(metadataURI).length == 0) revert EmptyURI();
        if (payoutAmount == 0) revert InvalidAmount();
        if (claimWindow == 0 || submissionWindow == 0 || reviewWindow == 0) revert InvalidDuration();

        bounty.metadataURI = metadataURI;
        bounty.payoutAmount = payoutAmount;
        bounty.claimDeadline = uint64(block.timestamp + claimWindow);
        bounty.submissionWindow = submissionWindow;
        bounty.reviewWindow = reviewWindow;
        _configureMilestones(bounty, payoutAmount, milestoneAmounts, milestoneCount);

        if (payoutAmount > previousPayout) {
            _safeTransferFrom(stablecoin, msg.sender, address(this), payoutAmount - previousPayout);
        } else if (payoutAmount < previousPayout) {
            _safeTransfer(stablecoin, msg.sender, previousPayout - payoutAmount);
        }

        emit BountyUpdated(
            bountyId,
            payoutAmount,
            bounty.claimDeadline,
            bounty.milestoneCount,
            metadataURI
        );
    }

    function submitResult(uint256 bountyId, string calldata resultURI) external {
        Bounty storage bounty = _getBounty(bountyId);

        if (bounty.status != Status.Claimed && bounty.status != Status.RevisionRequested) {
            revert BountyNotResubmittable();
        }
        if (msg.sender != bounty.claimant) revert NotClaimant();
        if (bytes(resultURI).length == 0) revert EmptyURI();
        if (block.timestamp > bounty.submissionDeadline) revert DeadlineExpired();

        bounty.resultURI = resultURI;
        bounty.reviewURI = "";
        bounty.disputeURI = "";
        bounty.disputeRaisedBy = address(0);
        bounty.reviewDeadline = uint64(block.timestamp + bounty.reviewWindow);
        bounty.status = Status.Submitted;

        emit ResultSubmitted(bountyId, msg.sender, bounty.reviewDeadline, resultURI);
    }

    function approveBounty(uint256 bountyId, string calldata reviewURI) external {
        Bounty storage bounty = _getBounty(bountyId);

        if (bounty.status != Status.Submitted) revert BountyNotSubmitted();
        if (msg.sender != bounty.creator) revert NotCreator();
        if (bytes(reviewURI).length == 0) revert EmptyURI();

        _releaseCurrentMilestone(bountyId, bounty, reviewURI);
    }

    function requestChanges(uint256 bountyId, string calldata reviewURI) external {
        Bounty storage bounty = _getBounty(bountyId);

        if (bounty.status != Status.Submitted) revert BountyNotSubmitted();
        if (msg.sender != bounty.creator) revert NotCreator();
        if (bytes(reviewURI).length == 0) revert EmptyURI();

        bounty.reviewURI = reviewURI;
        bounty.disputeURI = "";
        bounty.disputeRaisedBy = address(0);
        bounty.submissionDeadline = uint64(block.timestamp + bounty.submissionWindow);
        bounty.reviewDeadline = 0;
        bounty.status = Status.RevisionRequested;

        emit BountyRevisionRequested(bountyId, msg.sender, bounty.submissionDeadline, reviewURI);
    }

    function openDispute(uint256 bountyId, string calldata disputeURI) external {
        Bounty storage bounty = _getBounty(bountyId);

        if (bounty.status != Status.Submitted && bounty.status != Status.RevisionRequested) {
            revert BountyNotDisputable();
        }
        if (bytes(disputeURI).length == 0) revert EmptyURI();
        if (msg.sender != bounty.creator && msg.sender != bounty.claimant) revert NotParticipant();

        bounty.disputeURI = disputeURI;
        bounty.disputeRaisedBy = msg.sender;
        bounty.reviewDeadline = 0;
        bounty.status = Status.Disputed;

        emit BountyDisputed(bountyId, msg.sender, disputeURI);
    }

    function postBountyMessage(uint256 bountyId, string calldata messageURI) external {
        Bounty storage bounty = _getBounty(bountyId);

        if (bytes(messageURI).length == 0) revert EmptyURI();
        if (msg.sender != bounty.creator && msg.sender != bounty.claimant) revert NotParticipant();

        emit BountyMessagePosted(bountyId, msg.sender, uint64(block.timestamp), messageURI);
    }

    function cancelUnclaimedBounty(uint256 bountyId) external {
        Bounty storage bounty = _getBounty(bountyId);

        if (bounty.status != Status.Open) revert BountyNotOpen();
        if (msg.sender != bounty.creator) revert NotCreator();
        if (block.timestamp <= bounty.claimDeadline) revert DeadlineNotReached();

        bounty.status = Status.Cancelled;
        _safeTransfer(stablecoin, bounty.creator, bounty.remainingAmount);
        bounty.remainingAmount = 0;

        emit BountyCancelled(bountyId, bounty.creator);
    }

    function reclaimExpiredClaim(uint256 bountyId) external {
        Bounty storage bounty = _getBounty(bountyId);

        if (bounty.status != Status.Claimed && bounty.status != Status.RevisionRequested) {
            revert BountyNotClaimed();
        }
        if (msg.sender != bounty.creator) revert NotCreator();
        if (block.timestamp <= bounty.submissionDeadline) revert DeadlineNotReached();

        bounty.status = Status.Cancelled;
        _safeTransfer(stablecoin, bounty.creator, bounty.remainingAmount);
        bounty.remainingAmount = 0;

        emit BountyCancelled(bountyId, bounty.creator);
    }

    function releaseAfterReviewTimeout(uint256 bountyId) external {
        Bounty storage bounty = _getBounty(bountyId);

        if (bounty.status != Status.Submitted) revert BountyNotSubmitted();
        if (block.timestamp <= bounty.reviewDeadline) revert DeadlineNotReached();

        _releaseCurrentMilestone(bountyId, bounty, "");
    }

    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        return _getBounty(bountyId);
    }

    function _getBounty(uint256 bountyId) private view returns (Bounty storage bounty) {
        bounty = _bounties[bountyId];
        if (bounty.creator == address(0)) revert BountyNotFound();
    }

    function _configureMilestones(
        Bounty storage bounty,
        uint128 payoutAmount,
        uint128[3] calldata milestoneAmounts,
        uint8 milestoneCount
    ) private {
        if (milestoneCount == 0 || milestoneCount > 3) revert InvalidMilestonePlan();

        uint256 total;

        for (uint256 i; i < 3; ++i) {
            uint128 amount = milestoneAmounts[i];

            if (i < milestoneCount) {
                if (amount == 0) revert InvalidMilestonePlan();
                total += amount;
                bounty.milestoneAmounts[i] = amount;
            } else {
                if (amount != 0) revert InvalidMilestonePlan();
                bounty.milestoneAmounts[i] = 0;
            }
        }

        if (total != payoutAmount) revert InvalidMilestonePlan();

        bounty.milestoneCount = milestoneCount;
        bounty.releasedMilestones = 0;
        bounty.remainingAmount = payoutAmount;
    }

    function _releaseCurrentMilestone(
        uint256 bountyId,
        Bounty storage bounty,
        string memory reviewURI
    ) private {
        uint8 milestoneNumber = bounty.releasedMilestones + 1;
        uint128 milestoneAmount = bounty.milestoneAmounts[bounty.releasedMilestones];

        bounty.reviewURI = reviewURI;
        bounty.disputeURI = "";
        bounty.disputeRaisedBy = address(0);
        bounty.remainingAmount -= milestoneAmount;
        bounty.releasedMilestones = milestoneNumber;

        _safeTransfer(stablecoin, bounty.claimant, milestoneAmount);

        emit MilestoneReleased(
            bountyId,
            bounty.claimant,
            milestoneNumber,
            milestoneAmount,
            bounty.remainingAmount,
            reviewURI
        );

        if (bounty.releasedMilestones >= bounty.milestoneCount) {
            bounty.status = Status.Approved;
            emit BountyApproved(bountyId, bounty.claimant, milestoneAmount, reviewURI);
            return;
        }

        bounty.status = Status.Claimed;
        bounty.submissionDeadline = uint64(block.timestamp + bounty.submissionWindow);
        bounty.reviewDeadline = 0;
        bounty.resultURI = "";
        bounty.reviewURI = "";
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
