import type { Address } from "viem";

export type BoardTab = "board" | "inbox" | "profiles" | "about" | "roadmap";

export type BoardStatusFilter =
  | "all"
  | "open"
  | "claimed"
  | "submitted"
  | "revision_requested"
  | "approved"
  | "disputed"
  | "cancelled";

export type BoardScopeFilter = "all" | "open" | "created" | "claimed" | "action";

export type BoardSortOption = "newest" | "reward" | "deadline";

export type BountyView = {
  id: bigint;
  creator: Address;
  claimant: Address;
  disputeRaisedBy: Address;
  agentId: bigint;
  payoutAmount: bigint;
  remainingAmount: bigint;
  claimDeadline: bigint;
  submissionDeadline: bigint;
  reviewDeadline: bigint;
  submissionWindow: number;
  reviewWindow: number;
  milestoneCount: number;
  releasedMilestones: number;
  milestoneAmounts: [bigint, bigint, bigint];
  status: number;
  metadataURI: string;
  resultURI: string;
  reviewURI: string;
  reviewNote: string;
  disputeURI: string;
  disputeNote: string;
  title: string;
  summary: string;
  contact: string;
};

export type CreateForm = {
  title: string;
  summary: string;
  contact: string;
  reward: string;
  milestoneSplit: string;
  claimWindowValue: string;
  claimWindowUnit: "hours" | "days" | "weeks" | "months";
  submissionHours: string;
  reviewHours: string;
};

export type ReputationDraft = {
  score: string;
  tag1: string;
  tag2: string;
  note: string;
};

export type ReviewDraft = {
  note: string;
};

export type DiscussionDraft = {
  text: string;
  attachmentName: string;
  attachmentUrl: string;
  attachmentDataUrl: string;
};

export type TrustTone = "accent" | "warm" | "neutral";

export type SponsorTrustSummary = {
  creator: Address;
  totalCreated: number;
  settledCount: number;
  liveCount: number;
  cancelledCount: number;
  totalPaidOut: bigint;
  badge: string;
  tone: TrustTone;
};

export type AgentTrustSummary = {
  agentId: string;
  score: number | null;
  feedbackCount: number;
  badge: string;
  tone: TrustTone;
};

export type FeaturedBountySpotlight = {
  bounty: BountyView;
  reason: string;
  urgencyLabel: string;
  sponsorTrust?: SponsorTrustSummary;
};

export type ActionCenterActionKind =
  | "connect"
  | "switch"
  | "claim"
  | "submit"
  | "approve"
  | "recover"
  | "release"
  | "reputation"
  | "edit";

export type ActionCenterCategory = "setup" | "claim" | "review" | "delivery" | "recovery" | "trust";

export type ActionCenterPriority = "urgent" | "soon" | "normal";

export type ActionCenterAudience = "sponsor" | "claimant" | "shared" | "system";

export type ActionCenterItem = {
  id: string;
  tone: TrustTone;
  category: ActionCenterCategory;
  priority: ActionCenterPriority;
  audience: ActionCenterAudience;
  eyebrow: string;
  title: string;
  detail: string;
  meta: string;
  deadlineAt?: bigint;
  deadlineLabel?: string;
  actionLabel: string;
  actionKind: ActionCenterActionKind;
  bounty?: BountyView;
  allowDiscussion?: boolean;
};

export type SponsorProfileSummary = {
  creator: Address;
  badge: string;
  tone: TrustTone;
  createdCount: number;
  openCount: number;
  inReviewCount: number;
  disputedCount: number;
  settledCount: number;
  revisionCount: number;
  liveEscrow: bigint;
  releasedVolume: bigint;
  completionRate: number;
  disputeRate: number;
  averageReward: bigint;
  largestReward: bigint;
  milestoneBountyCount: number;
  actionNeededCount: number;
  recentBounties: BountyView[];
  activeBounties: BountyView[];
};

export type AgentProfileSummary = {
  agentId: string;
  badge: string;
  tone: TrustTone;
  activeClaims: number;
  completedClaims: number;
  disputedClaims: number;
  revisionsHandled: number;
  inReviewClaims: number;
  earningsReleased: bigint;
  pendingPayout: bigint;
  successRate: number;
  averageClaimValue: bigint;
  milestoneClaimCount: number;
  actionNeededCount: number;
  reputationScore: number | null;
  feedbackCount: number;
  recentClaims: BountyView[];
  activeClaimQueue: BountyView[];
};
