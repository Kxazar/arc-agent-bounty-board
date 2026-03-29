import type { BountyResult } from "@/lib/agent-tools";
import { parseBountyMetadata, parseBountyNoteUri } from "@/lib/agent-tools";
import type { BountyView, DiscussionDraft, ReputationDraft, ReviewDraft } from "@/components/bounty-board-types";

export const visibleBountyCount = 20;

export type ClaimForm = {
  bountyId: string;
  agentId: string;
};

export type ResultForm = {
  bountyId: string;
  resultURI: string;
};

export type BoardActionName =
  | "approveBounty"
  | "requestChanges"
  | "openDispute"
  | "cancelUnclaimedBounty"
  | "reclaimExpiredClaim"
  | "releaseAfterReviewTimeout";

export function defaultDiscussionDraft(): DiscussionDraft {
  return {
    text: "",
    attachmentName: "",
    attachmentUrl: "",
    attachmentDataUrl: ""
  };
}

export function defaultReputationDraft(title: string): ReputationDraft {
  return {
    score: "95",
    tag1: "successful_delivery",
    tag2: "arc_bounty",
    note: `Settled "${title}" successfully on Arc.`
  };
}

export function defaultReviewDraft(title: string): ReviewDraft {
  return {
    note: `Reviewing "${title}" on Arc.`
  };
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong while talking to Arc.";
}

export function parsePositiveWholeNumber(value: string, label: string) {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a whole number.`);
  }

  const parsed = Number(trimmed);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return parsed;
}

export function parseNumericId(value: string, label: string) {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a numeric ID.`);
  }

  return BigInt(trimmed);
}

export function mapBounty(id: bigint, raw: BountyResult): BountyView {
  const metadata = parseBountyMetadata(raw.metadataURI);
  const reviewPayload = raw.reviewURI ? parseBountyNoteUri(raw.reviewURI) : null;
  const disputePayload = raw.disputeURI ? parseBountyNoteUri(raw.disputeURI) : null;

  return {
    id,
    creator: raw.creator,
    claimant: raw.claimant,
    disputeRaisedBy: raw.disputeRaisedBy,
    agentId: raw.agentId,
    payoutAmount: raw.payoutAmount,
    remainingAmount: raw.remainingAmount,
    claimDeadline: raw.claimDeadline,
    submissionDeadline: raw.submissionDeadline,
    reviewDeadline: raw.reviewDeadline,
    submissionWindow: raw.submissionWindow,
    reviewWindow: raw.reviewWindow,
    milestoneCount: raw.milestoneCount,
    releasedMilestones: raw.releasedMilestones,
    milestoneAmounts: [...raw.milestoneAmounts] as [bigint, bigint, bigint],
    status: Number(raw.status),
    metadataURI: raw.metadataURI,
    resultURI: raw.resultURI,
    reviewURI: raw.reviewURI,
    reviewNote: reviewPayload?.note ?? "",
    disputeURI: raw.disputeURI,
    disputeNote: disputePayload?.note ?? "",
    title: metadata?.title ?? `Bounty #${id.toString()}`,
    summary: metadata?.summary ?? "Metadata stored onchain-ready as a URI.",
    contact: metadata?.contact ?? "discord:tbd"
  };
}
