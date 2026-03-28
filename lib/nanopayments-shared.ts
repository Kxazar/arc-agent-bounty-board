export const nanopaymentProductName = "Arc Market Signal Feed";
export const nanopaymentMarketSignalEndpoint = "/api/nanopayments/market-signal";
export const nanopaymentMarketSignalPrice = "$0.001";
export const nanopaymentIntakeBriefProductName = "Arc Agent Intake Brief";
export const nanopaymentIntakeBriefEndpoint = "/api/nanopayments/intake-brief";
export const nanopaymentIntakeBriefPrice = "$0.002";
export const nanopaymentDocs = [
  {
    label: "Circle Nanopayments",
    url: "https://developers.circle.com/gateway/nanopayments"
  },
  {
    label: "x402 on Circle Gateway",
    url: "https://developers.circle.com/gateway/nanopayments/concepts/x402"
  }
] as const;

export type MarketSignalPreviewPayload = {
  mode: "preview";
  product: string;
  endpoint: string;
  price: string;
  network: string;
  settlement: string;
  description: string;
  includes: string[];
  docs: {
    label: string;
    url: string;
  }[];
};

export type IntakeBriefPreviewPayload = {
  mode: "preview";
  product: string;
  endpoint: string;
  price: string;
  network: string;
  settlement: string;
  description: string;
  targetHint: string;
  includes: string[];
  docs: {
    label: string;
    url: string;
  }[];
};

export type IntakeBriefPremiumPayload = {
  mode: "premium";
  product: string;
  generatedAt: string;
  network: string;
  contract: string;
  endpoint: string;
  price: string;
  targeting: {
    requestedBountyId: string | null;
    selectedBountyId: string;
    wasFallback: boolean;
    requestedAgentId: string | null;
  };
  selectedBounty: {
    id: string;
    title: string;
    status: string;
    summary: string;
    rewardUsdc: string;
    claimWindow: string;
    submissionWindowHours: number;
    reviewWindowHours: number;
    creator: string;
    claimant: string | null;
    agentId: string | null;
    contact: string;
  };
  claimReadiness: {
    canClaimNow: boolean;
    blocker: string | null;
    recommendedAction: string;
    checklist: string[];
  };
  privateSponsorContext: {
    trustTier: string;
    sponsorScore: number;
    settlementHistory: string;
    currentLoad: string;
    likelyReviewSpeed: string;
    openingAngle: string;
  };
  webhookEnvelope: {
    event: string;
    dedupeKey: string;
    method: "POST";
    contentType: "application/json";
    targetPath: string;
    samplePayload: {
      bountyId: string;
      title: string;
      rewardUsdc: string;
      requestedAgentId: string | null;
      recommendedAction: string;
      contact: string;
    };
  };
  automationHints: string[];
};

export type MarketSignalPremiumPayload = {
  mode: "premium";
  product: string;
  generatedAt: string;
  network: string;
  contract: string;
  endpoint: string;
  price: string;
  coverage: {
    visibleBounties: number;
    openCount: number;
    reviewQueueCount: number;
    disputedCount: number;
  };
  liquidity: {
    liveEscrowUsdc: string;
    settledVolumeUsdc: string;
    averageOpenRewardUsdc: string;
    largestOpenRewardUsdc: string;
  };
  sponsorLeaders: {
    creator: string;
    totalCreated: number;
    settledCount: number;
    liveCount: number;
    totalPaidOutUsdc: string;
  }[];
  hottestOpenBounties: {
    id: string;
    title: string;
    rewardUsdc: string;
    closesIn: string;
    sponsor: string;
    contact: string;
    reason: string;
  }[];
  reviewQueue: {
    id: string;
    title: string;
    status: string;
    creator: string;
    claimant: string;
    agentId: string | null;
    lockedRewardUsdc: string;
    actionNeeded: string;
  }[];
  operatorNote: string;
};
