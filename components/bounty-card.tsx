import type { Address } from "viem";
import { zeroAddress } from "viem";

import { externalLinkProps, statusLabels } from "@/components/bounty-board-config";
import type {
  BountyView,
  ReputationDraft,
  ReviewDraft,
  SponsorTrustSummary,
  TrustTone
} from "@/components/bounty-board-types";
import { BountyReviewPanel } from "@/components/bounty-review-panel";
import { ReputationComposer } from "@/components/reputation-composer";
import { formatReputation, type ReputationSummary } from "@/lib/agent-tools";
import { explorerAddressLink, formatDateTime, formatUsdc, shortenAddress } from "@/lib/format";

type NextActionTone = "neutral" | "ready" | "warning";

interface BountyCardProps {
  bounty: BountyView;
  connectedAddress?: Address;
  ownedAgentCount: number;
  selectedClaimAgentId: string;
  reputation?: ReputationSummary;
  sponsorTrust?: SponsorTrustSummary;
  reviewDraft: ReviewDraft;
  reputationDraft: ReputationDraft;
  isComposerOpen: boolean;
  isReviewOpen: boolean;
  isDiscussionOpen: boolean;
  isWriting: boolean;
  isSwitching: boolean;
  isPostingReputation: boolean;
  reputationReceipt?: string;
  onPrimeClaim: (bountyId: bigint) => void;
  onPrimeEdit: (bounty: BountyView) => void;
  onQuickClaim: (bountyId: string, agentId: string) => void | Promise<void>;
  onPrimeSubmit: (bountyId: bigint) => void;
  onApprove: (bounty: BountyView) => void | Promise<void>;
  onCancelAfterDeadline: (bounty: BountyView) => void | Promise<void>;
  onRecoverAfterMissedSubmit: (bounty: BountyView) => void | Promise<void>;
  onReleaseAfterTimeout: (bounty: BountyView) => void | Promise<void>;
  onOpenDiscussion: (bounty: BountyView) => void | Promise<void>;
  onOpenReviewComposer: (bounty: BountyView) => void;
  onOpenReputationComposer: (bounty: BountyView) => void;
  onUpdateReviewDraft: (bountyId: string, bountyTitle: string, updater: (draft: ReviewDraft) => ReviewDraft) => void;
  onUpdateReputationDraft: (
    bountyId: string,
    bountyTitle: string,
    updater: (draft: ReputationDraft) => ReputationDraft
  ) => void;
  onRequestChanges: (bounty: BountyView) => void | Promise<void>;
  onOpenDispute: (bounty: BountyView) => void | Promise<void>;
  onSubmitReputation: (bounty: BountyView) => void | Promise<void>;
}

function describeRelativeTime(timestamp: bigint) {
  if (timestamp === 0n) return null;

  const deltaMs = Number(timestamp) * 1000 - Date.now();
  const absoluteMinutes = Math.max(0, Math.floor(Math.abs(deltaMs) / 60000));

  if (absoluteMinutes === 0) {
    return deltaMs >= 0 ? "less than 1m left" : "just expired";
  }

  const days = Math.floor(absoluteMinutes / 1_440);
  const hours = Math.floor((absoluteMinutes % 1_440) / 60);
  const minutes = absoluteMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 && parts.length < 2) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0 && parts.length < 2) parts.push(`${minutes}m`);

  const compact = parts.join(" ");
  return deltaMs >= 0 ? `in ${compact}` : `${compact} ago`;
}

function getRelevantWindow(bounty: BountyView) {
  if (bounty.status === 0) {
    return { label: "Claim window", value: bounty.claimDeadline };
  }

  if (bounty.status === 1) {
    return { label: "Delivery due", value: bounty.submissionDeadline };
  }

  if (bounty.status === 2) {
    return { label: "Review window", value: bounty.reviewDeadline };
  }

  if (bounty.status === 3) {
    return { label: "Revision due", value: bounty.submissionDeadline };
  }

  return null;
}

function getRoleLabel(isCreator: boolean, isClaimant: boolean, isConnected: boolean) {
  if (isCreator && isClaimant) return "Creator + claimant";
  if (isCreator) return "Creator";
  if (isClaimant) return "Claimant";
  if (isConnected) return "Observer";
  return "Guest";
}

function getNextActionCopy({
  bounty,
  isConnected,
  isCreator,
  isClaimant,
  ownedAgentCount,
  selectedClaimAgentId,
  windowExpired
}: {
  bounty: BountyView;
  isConnected: boolean;
  isCreator: boolean;
  isClaimant: boolean;
  ownedAgentCount: number;
  selectedClaimAgentId: string;
  windowExpired: boolean;
}) {
  if (bounty.status === 0) {
    if (isCreator) {
      return windowExpired
        ? {
            tone: "warning" as NextActionTone,
            title: "Claim window ended. Recover the escrow if you want to relist later.",
            detail: "The current task did not get picked up in time. You can cancel and reclaim the locked USDC."
          }
        : {
            tone: "neutral" as NextActionTone,
            title: "This bounty is live and waiting for the right Arc agent.",
            detail: "You can still refine the scope, keep the discussion line warm, or let the current window play out."
          };
    }

    if (!isConnected) {
      return {
        tone: "neutral" as NextActionTone,
        title: "Connect a wallet to start claiming work.",
        detail: "Once connected on Arc, select an agent ID in Claim Studio and quick-claim directly from this card."
      };
    }

    if (selectedClaimAgentId !== "") {
      return {
        tone: "ready" as NextActionTone,
        title: `Your selected agent #${selectedClaimAgentId} is ready to claim.`,
        detail: "Use Quick claim for the fastest path or open the studio to review the bounty context first."
      };
    }

    if (ownedAgentCount > 0) {
      return {
        tone: "neutral" as NextActionTone,
        title: "Pick one of your owned agents to unlock quick-claim.",
        detail: "The claim studio already lists your ERC-8004 identities, so you do not have to paste an agent ID manually."
      };
    }

    return {
      tone: "warning" as NextActionTone,
      title: "You need an Arc agent identity before you can claim this bounty.",
      detail: "Register an agent first, then come back and the claim flow becomes one click."
    };
  }

  if (bounty.status === 1) {
    if (isClaimant) {
      return windowExpired
        ? {
            tone: "warning" as NextActionTone,
            title: "Delivery window has expired for this claimant slot.",
            detail: "If you still have the work ready, coordinate immediately. The sponsor can recover funds after a missed submit window."
          }
        : {
            tone: "ready" as NextActionTone,
            title: "Deliver the result and submit before the window closes.",
            detail: "Open Prepare submit to attach the final URI and keep the proof trail clean on Arc."
          };
    }

    if (isCreator) {
      return {
        tone: "neutral" as NextActionTone,
        title: "An agent is working on this bounty right now.",
        detail: "Use the in-app discussion room for clarifications while escrow stays locked until submission or timeout."
      };
    }

    return {
      tone: "neutral" as NextActionTone,
      title: "This bounty is currently in delivery.",
      detail: "The selected agent has already claimed the task, so the next step is submission or timeout resolution."
    };
  }

  if (bounty.status === 2) {
    if (isCreator) {
      return windowExpired
        ? {
            tone: "warning" as NextActionTone,
            title: "Review timeout is over. Decide now or the claimant can release escrow.",
            detail: "Pass review, request changes, or move the bounty into dispute before the inactive path settles it."
          }
        : {
            tone: "ready" as NextActionTone,
            title: "Review the delivery before any payout leaves escrow.",
            detail: "This is the sponsor-side gate: pass review, request changes, or escalate into dispute."
          };
    }

    if (isClaimant) {
      return windowExpired
        ? {
            tone: "ready" as NextActionTone,
            title: "You can release payout after the review timeout.",
            detail: "If the sponsor stays inactive, use the timeout path to settle the bounty from escrow."
          }
        : {
            tone: "neutral" as NextActionTone,
            title: "Waiting for sponsor review.",
            detail: "The result is already submitted. Keep the discussion channel open while the sponsor reviews it."
          };
    }

    return {
      tone: "neutral" as NextActionTone,
      title: "Submission is under sponsor review.",
      detail: "The next state change will be review approval, requested changes, dispute, or timeout-based release."
    };
  }

  if (bounty.status === 3) {
    if (isClaimant) {
      return windowExpired
        ? {
            tone: "warning" as NextActionTone,
            title: "Revision deadline has lapsed for the claimant.",
            detail: "Either resubmit immediately if still possible or expect the sponsor to recover escrow after the missed revision window."
          }
        : {
            tone: "ready" as NextActionTone,
            title: "The sponsor requested changes before payout.",
            detail: "Revise and resubmit, or open dispute if the review is not aligned with the agreed scope."
          };
    }

    if (isCreator) {
      return {
        tone: "neutral" as NextActionTone,
        title: "Revision request is out with the claimant.",
        detail: "Escrow stays locked while you wait for a new submission or a claimant-side dispute."
      };
    }

    return {
      tone: "neutral" as NextActionTone,
      title: "This bounty is in a revision cycle.",
      detail: "The last submission did not pass sponsor review and is waiting for an updated delivery."
    };
  }

  if (bounty.status === 4) {
    if (isCreator) {
      return {
        tone: "ready" as NextActionTone,
        title: "Payout settled. Post reputation to complete the story.",
        detail: "This is where Arc-native reputation turns a finished bounty into reusable agent trust."
      };
    }

    if (isClaimant) {
      return {
        tone: "ready" as NextActionTone,
        title: "Payout reached the claimant wallet.",
        detail: "You can now use the result link and discussion history as proof of execution for future bounties."
      };
    }

    return {
      tone: "neutral" as NextActionTone,
      title: "This bounty has been completed on Arc.",
      detail: "Settlement is done and the remaining product loop is reputation and discoverability."
    };
  }

  if (bounty.status === 5) {
    return {
      tone: "warning" as NextActionTone,
      title: "A dispute is open and the payout is frozen.",
      detail: "Discussion can continue inside the product, but decentralized dispute resolution is still a planned Arc-native milestone."
    };
  }

  return {
    tone: "neutral" as NextActionTone,
    title: "This bounty is closed.",
    detail: "Cancelled tasks stay visible as market history and can be recreated with a better scope later."
  };
}

function getAgentTrustBadge(reputation?: ReputationSummary): { label: string; tone: TrustTone } {
  if (!reputation || reputation.count === 0 || reputation.score === null) {
    return { label: "New agent", tone: "neutral" };
  }

  if (reputation.score >= 90 && reputation.count >= 2) {
    return { label: "High trust agent", tone: "accent" };
  }

  if (reputation.score >= 75) {
    return { label: "Rated agent", tone: "warm" };
  }

  return { label: "Emerging agent", tone: "neutral" };
}

function disputeAuthorLabel(bounty: BountyView) {
  if (bounty.disputeRaisedBy === zeroAddress) {
    return "participant";
  }

  if (bounty.disputeRaisedBy.toLowerCase() === bounty.creator.toLowerCase()) {
    return "creator";
  }

  if (bounty.disputeRaisedBy.toLowerCase() === bounty.claimant.toLowerCase()) {
    return "claimant";
  }

  return "participant";
}

export function BountyCard({
  bounty,
  connectedAddress,
  ownedAgentCount,
  selectedClaimAgentId,
  reputation,
  sponsorTrust,
  reviewDraft,
  reputationDraft,
  isComposerOpen,
  isReviewOpen,
  isDiscussionOpen,
  isWriting,
  isSwitching,
  isPostingReputation,
  reputationReceipt,
  onPrimeClaim,
  onPrimeEdit,
  onQuickClaim,
  onPrimeSubmit,
  onApprove,
  onCancelAfterDeadline,
  onRecoverAfterMissedSubmit,
  onReleaseAfterTimeout,
  onOpenDiscussion,
  onOpenReviewComposer,
  onOpenReputationComposer,
  onUpdateReviewDraft,
  onUpdateReputationDraft,
  onRequestChanges,
  onOpenDispute,
  onSubmitReputation
}: BountyCardProps) {
  const bountyKey = bounty.id.toString();
  const isConnected = Boolean(connectedAddress);
  const isCreator =
    connectedAddress ? bounty.creator.toLowerCase() === connectedAddress.toLowerCase() : false;
  const isClaimant =
    connectedAddress && bounty.claimant !== zeroAddress
      ? bounty.claimant.toLowerCase() === connectedAddress.toLowerCase()
      : false;
  const canOpenDiscussion = isCreator || isClaimant;
  const canQuickClaim = bounty.status === 0 && selectedClaimAgentId !== "";
  const roleLabel = getRoleLabel(isCreator, isClaimant, isConnected);
  const activeWindow = getRelevantWindow(bounty);
  const windowExpired = activeWindow ? Number(activeWindow.value) * 1000 <= Date.now() : false;
  const windowRelative = activeWindow ? describeRelativeTime(activeWindow.value) : null;
  const agentTrustBadge = getAgentTrustBadge(reputation);
  const releasedAmount = bounty.payoutAmount - bounty.remainingAmount;
  const activeMilestoneNumber =
    bounty.releasedMilestones >= bounty.milestoneCount
      ? bounty.milestoneCount
      : bounty.releasedMilestones + 1;
  const activeMilestoneAmount =
    bounty.milestoneCount > 0
      ? bounty.milestoneAmounts[Math.min(bounty.releasedMilestones, bounty.milestoneCount - 1)]
      : 0n;
  const nextAction = getNextActionCopy({
    bounty,
    isConnected,
    isCreator,
    isClaimant,
    ownedAgentCount,
    selectedClaimAgentId,
    windowExpired
  });

  return (
    <article className="bounty-card">
      <div className="bounty-head">
        <div>
          <div className="card-label">#{bountyKey}</div>
          <h3>{bounty.title}</h3>
        </div>
        <span className={`status-pill status-${(statusLabels[bounty.status] ?? "unknown").toLowerCase().replaceAll(" ", "-")}`}>
          {statusLabels[bounty.status] ?? "Unknown"}
        </span>
      </div>

      <p className="bounty-summary">{bounty.summary}</p>

      <div className={`next-step-panel next-step-${nextAction.tone}`}>
        <div className="next-step-head">
          <span className="action-badge">{roleLabel}</span>
          {activeWindow ? (
            <span className={`deadline-chip ${windowExpired ? "deadline-chip-expired" : ""}`}>
              {activeWindow.label}
              {windowRelative ? ` ${windowRelative}` : ""}
            </span>
          ) : (
            <span className="deadline-chip">Status {statusLabels[bounty.status] ?? "Unknown"}</span>
          )}
        </div>
        <strong>{nextAction.title}</strong>
        <p>{nextAction.detail}</p>
        {activeWindow ? <span className="next-step-meta">{formatDateTime(activeWindow.value)}</span> : null}
      </div>

      <div className="signal-row">
        <div className="signal-chip">
          <span className="trust-badge trust-neutral">
            {bounty.milestoneCount > 1 ? `Milestones ${bounty.releasedMilestones}/${bounty.milestoneCount}` : "Single payout"}
          </span>
          <span>
            Released {formatUsdc(releasedAmount)}
            {bounty.milestoneCount > 1 ? ` | Active tranche ${activeMilestoneNumber}: ${formatUsdc(activeMilestoneAmount)}` : ""}
          </span>
        </div>

        {sponsorTrust ? (
          <div className="signal-chip">
            <span className={`trust-badge trust-${sponsorTrust.tone}`}>{sponsorTrust.badge}</span>
            <span>
              Sponsor settled {sponsorTrust.settledCount}
              {sponsorTrust.totalPaidOut > 0n ? ` | ${formatUsdc(sponsorTrust.totalPaidOut)} paid` : ""}
            </span>
          </div>
        ) : (
          <div className="signal-chip">
            <span className="trust-badge trust-neutral">New sponsor</span>
            <span>No visible payout history on this board yet.</span>
          </div>
        )}

        <div className="signal-chip">
          <span className={`trust-badge trust-${agentTrustBadge.tone}`}>{agentTrustBadge.label}</span>
          <span>{bounty.agentId > 0n ? formatReputation(reputation) : "Agent not assigned yet"}</span>
        </div>
      </div>

      <div className="meta-grid">
        <div>
          <span>Reward</span>
          <strong>{formatUsdc(bounty.payoutAmount)}</strong>
        </div>
        <div>
          <span>Creator</span>
          <a {...externalLinkProps} href={explorerAddressLink(bounty.creator)}>
            {shortenAddress(bounty.creator)}
          </a>
        </div>
        <div>
          <span>Claimant</span>
          <strong>{bounty.claimant === zeroAddress ? "Unclaimed" : shortenAddress(bounty.claimant)}</strong>
        </div>
        <div>
          <span>Agent ID</span>
          <strong>{bounty.agentId === 0n ? "Not set" : bounty.agentId.toString()}</strong>
        </div>
        <div>
          <span>Escrow left</span>
          <strong>{formatUsdc(bounty.remainingAmount)}</strong>
        </div>
        <div>
          <span>Claim deadline</span>
          <strong>{formatDateTime(bounty.claimDeadline)}</strong>
        </div>
        <div>
          <span>Delivery due</span>
          <strong>{formatDateTime(bounty.submissionDeadline)}</strong>
        </div>
        <div>
          <span>Review deadline</span>
          <strong>{formatDateTime(bounty.reviewDeadline)}</strong>
        </div>
      </div>

      {bounty.agentId > 0n ? (
        <div className="reputation-strip">
          <div>
            <span className="card-label">Reputation pulse</span>
            <strong>{formatReputation(reputation)}</strong>
          </div>
          <div className="reputation-meta">
            <span>{reputation?.count ? `${reputation.count} feedback items` : "No feedback yet"}</span>
            <span>Agent #{bounty.agentId.toString()}</span>
          </div>
        </div>
      ) : null}

      {bounty.reviewNote ? (
        <div className="review-note-panel">
          <span className="card-label">Latest review note</span>
          <p>{bounty.reviewNote}</p>
        </div>
      ) : null}

      {bounty.disputeNote ? (
        <div className="dispute-note-panel">
          <span className="card-label">Dispute opened by {disputeAuthorLabel(bounty)}</span>
          <p>{bounty.disputeNote}</p>
        </div>
      ) : null}

      <div className="card-footer">
        <div className="card-links">
          <a {...externalLinkProps} href={bounty.metadataURI}>
            Metadata
          </a>
          {bounty.resultURI ? (
            <a {...externalLinkProps} href={bounty.resultURI}>
              Result
            </a>
          ) : null}
          <span>{bounty.contact}</span>
        </div>

        <div className="card-actions">
          {bounty.status === 0 && !isCreator ? (
            <button className="button button-secondary" onClick={() => onPrimeClaim(bounty.id)} type="button">
              Prepare claim
            </button>
          ) : null}

          {isCreator && bounty.status === 0 ? (
            <button className="button button-secondary" onClick={() => onPrimeEdit(bounty)} type="button">
              Edit details
            </button>
          ) : null}

          {canQuickClaim && !isCreator && isConnected ? (
            <button
              className="button button-primary"
              disabled={isWriting || isSwitching}
              onClick={() => onQuickClaim(bounty.id.toString(), selectedClaimAgentId)}
              type="button"
            >
              Quick claim
            </button>
          ) : null}

          {(bounty.status === 1 || bounty.status === 3) && isClaimant ? (
            <button className="button button-secondary" onClick={() => onPrimeSubmit(bounty.id)} type="button">
              {bounty.status === 3 ? "Prepare resubmit" : "Prepare submit"}
            </button>
          ) : null}

          {bounty.status === 0 ? (
            <button
              className="button button-ghost"
              disabled={isWriting}
              onClick={() => onCancelAfterDeadline(bounty)}
              type="button"
            >
              Cancel after deadline
            </button>
          ) : null}

          {(bounty.status === 1 || bounty.status === 3) && isCreator ? (
            <button
              className="button button-ghost"
              disabled={isWriting}
              onClick={() => onRecoverAfterMissedSubmit(bounty)}
              type="button"
            >
              Recover after missed submit
            </button>
          ) : null}

          {bounty.status === 2 && isClaimant ? (
            <button
              className="button button-ghost"
              disabled={isWriting}
              onClick={() => onReleaseAfterTimeout(bounty)}
              type="button"
            >
              Release after timeout
            </button>
          ) : null}

          {canOpenDiscussion ? (
            <button className="button button-ghost" onClick={() => onOpenDiscussion(bounty)} type="button">
              {isDiscussionOpen ? "Discussion open" : "Open discussion"}
            </button>
          ) : null}
        </div>
      </div>

      <BountyReviewPanel
        bounty={bounty}
        draft={reviewDraft}
        isClaimant={isClaimant}
        isCreator={isCreator}
        isOpen={isReviewOpen}
        isWriting={isWriting}
        onApprove={() => onApprove(bounty)}
        onNoteChange={(value) =>
          onUpdateReviewDraft(bountyKey, bounty.title, (current) => ({
            ...current,
            note: value
          }))
        }
        onOpen={() => onOpenReviewComposer(bounty)}
        onOpenDispute={() => onOpenDispute(bounty)}
        onRequestChanges={() => onRequestChanges(bounty)}
      />

      {bounty.status === 4 && bounty.agentId > 0n ? (
        <ReputationComposer
          draft={reputationDraft}
          isOpen={isComposerOpen}
          isPosting={isPostingReputation}
          receiptUrl={reputationReceipt}
          onOpen={() => onOpenReputationComposer(bounty)}
          onScoreChange={(value) =>
            onUpdateReputationDraft(bountyKey, bounty.title, (current) => ({
              ...current,
              score: value
            }))
          }
          onTag1Change={(value) =>
            onUpdateReputationDraft(bountyKey, bounty.title, (current) => ({
              ...current,
              tag1: value
            }))
          }
          onTag2Change={(value) =>
            onUpdateReputationDraft(bountyKey, bounty.title, (current) => ({
              ...current,
              tag2: value
            }))
          }
          onNoteChange={(value) =>
            onUpdateReputationDraft(bountyKey, bounty.title, (current) => ({
              ...current,
              note: value
            }))
          }
          onSubmit={() => onSubmitReputation(bounty)}
        />
      ) : null}
    </article>
  );
}
