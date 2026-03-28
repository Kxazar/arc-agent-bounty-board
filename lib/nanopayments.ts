import { BatchFacilitatorClient, GatewayEvmScheme } from "@circle-fin/x402-batching/server";
import { x402HTTPResourceServer, type HTTPAdapter, type HTTPRequestContext } from "@x402/core/http";
import { x402ResourceServer, type FacilitatorClient } from "@x402/core/server";
import { createPublicClient, http, isAddress, type Address } from "viem";

import type { BountyView } from "@/components/bounty-board-types";
import { mapBounty, visibleBountyCount } from "@/hooks/bounty-board-shared";
import { arcBountyBoardAbi } from "@/lib/abi";
import { arcTestnet } from "@/lib/arc";
import type { BountyResult } from "@/lib/agent-tools";
import {
  nanopaymentDocs,
  nanopaymentIntakeBriefEndpoint,
  nanopaymentIntakeBriefPrice,
  nanopaymentIntakeBriefProductName,
  nanopaymentMarketSignalEndpoint,
  nanopaymentMarketSignalPrice,
  nanopaymentProductName,
  type IntakeBriefPremiumPayload,
  type IntakeBriefPreviewPayload,
  type MarketSignalPremiumPayload,
  type MarketSignalPreviewPayload
} from "@/lib/nanopayments-shared";

const fallbackSellerAddress = "0x58092111F88273F1E08445712A26B82099a99438";
const defaultFacilitatorUrl = "https://gateway-api-testnet.circle.com";
const visibleReviewStatuses = new Set([2, 3, 5]);
const visibleEscrowStatuses = new Set([0, 1, 2, 3, 5]);

let marketSignalServerPromise: Promise<x402HTTPResourceServer> | null = null;
let intakeBriefServerPromise: Promise<x402HTTPResourceServer> | null = null;

type SponsorStats = {
  creator: Address;
  totalCreated: number;
  settledCount: number;
  liveCount: number;
  totalPaidOut: bigint;
};

function formatUsdcValue(value: bigint) {
  return (Number(value) / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });
}

function describeTimeLeft(timestamp: bigint) {
  if (timestamp === 0n) return "No active window";

  const deltaMs = Number(timestamp) * 1000 - Date.now();
  const absoluteMinutes = Math.max(0, Math.floor(Math.abs(deltaMs) / 60_000));
  const days = Math.floor(absoluteMinutes / 1_440);
  const hours = Math.floor((absoluteMinutes % 1_440) / 60);
  const minutes = absoluteMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 && parts.length < 2) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0 && parts.length < 2) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push("1m");

  return deltaMs >= 0 ? `${parts.join(" ")} left` : `${parts.join(" ")} overdue`;
}

function toStatusLabel(status: number) {
  if (status === 0) return "Open";
  if (status === 1) return "Claimed";
  if (status === 2) return "Submitted";
  if (status === 3) return "Changes requested";
  if (status === 4) return "Approved";
  if (status === 5) return "Disputed";
  return "Cancelled";
}

function getReviewActionLabel(status: number) {
  if (status === 2) return "Creator review required before payout";
  if (status === 3) return "Claimant should revise and resubmit";
  if (status === 5) return "Escrow frozen until dispute resolution exists";
  return "No pending action";
}

function resolveBountyBoardAddress() {
  const candidate = process.env.NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS;

  if (!candidate || !isAddress(candidate)) {
    throw new Error("NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS is missing or invalid for nanopayments.");
  }

  return candidate as Address;
}

function resolveSellerAddress() {
  const configured = process.env.NANOPAYMENTS_SELLER_ADDRESS;

  if (configured && isAddress(configured)) {
    return configured as Address;
  }

  return fallbackSellerAddress as Address;
}

function getArcPublicClient() {
  const rpcUrl = process.env.ARC_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.testnet.arc.network";

  return createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl)
  });
}

async function readVisibleBounties() {
  const client = getArcPublicClient();
  const boardAddress = resolveBountyBoardAddress();
  const nextBountyId = (await client.readContract({
    address: boardAddress,
    abi: arcBountyBoardAbi,
    functionName: "nextBountyId"
  })) as bigint;

  if (nextBountyId === 0n) {
    return [] as BountyView[];
  }

  const ids: bigint[] = [];

  for (let current = nextBountyId - 1n; ids.length < visibleBountyCount; current -= 1n) {
    ids.push(current);

    if (current === 0n) break;
  }

  const items = await Promise.all(
    ids.map(async (id) => {
      const raw = (await client.readContract({
        address: boardAddress,
        abi: arcBountyBoardAbi,
        functionName: "getBounty",
        args: [id]
      })) as BountyResult;

      return mapBounty(id, raw);
    })
  );

  return items;
}

function buildSponsorStatsMap(bounties: BountyView[]) {
  const sponsorMap = new Map<string, SponsorStats>();

  for (const bounty of bounties) {
    const key = bounty.creator.toLowerCase();
    const current = sponsorMap.get(key) ?? {
      creator: bounty.creator,
      totalCreated: 0,
      settledCount: 0,
      liveCount: 0,
      totalPaidOut: 0n
    };

    current.totalCreated += 1;

    if (bounty.status === 4) {
      current.settledCount += 1;
      current.totalPaidOut += bounty.payoutAmount;
    }

    if (bounty.status !== 4 && bounty.status !== 6) {
      current.liveCount += 1;
    }

    sponsorMap.set(key, current);
  }

  return sponsorMap;
}

function rankOpenBountyScore(bounty: BountyView, sponsorStats?: SponsorStats) {
  const rewardScore = Number(bounty.payoutAmount) / 1_000_000;
  const hoursLeft = Math.max(0, (Number(bounty.claimDeadline) * 1000 - Date.now()) / 3_600_000);

  return (
    rewardScore * 100 +
    (hoursLeft <= 12 ? 32 : hoursLeft <= 24 ? 18 : hoursLeft <= 72 ? 8 : 0) +
    (sponsorStats?.settledCount ?? 0) * 14
  );
}

function buildMarketSignalPreviewPayload(): MarketSignalPreviewPayload {
  return {
    mode: "preview",
    product: nanopaymentProductName,
    endpoint: nanopaymentMarketSignalEndpoint,
    price: nanopaymentMarketSignalPrice,
    network: "Arc Testnet via Circle Gateway",
    settlement: "Gas-free micropayment settlement through Circle Gateway and x402 on Arc Testnet.",
    description:
      "Pay once and receive a compact machine-readable board intelligence snapshot: open opportunities, sponsor quality, review bottlenecks, and dispute pressure.",
    includes: [
      "Top open bounties ranked by reward, urgency, and sponsor quality",
      "Sponsor leaderboard based on visible settled history",
      "Review queue that highlights payouts blocked by sponsor review or dispute",
      "Operator note that summarizes the current state of the board"
    ],
    docs: nanopaymentDocs.map((entry) => ({
      label: entry.label,
      url: entry.url
    }))
  };
}

function buildMarketSignalPremiumPayload(bounties: BountyView[]): MarketSignalPremiumPayload {
  const openBounties = bounties.filter((bounty) => bounty.status === 0);
  const reviewQueue = bounties.filter((bounty) => visibleReviewStatuses.has(bounty.status));
  const disputedCount = bounties.filter((bounty) => bounty.status === 5).length;
  const liveEscrow = bounties
    .filter((bounty) => visibleEscrowStatuses.has(bounty.status))
    .reduce((sum, bounty) => sum + bounty.payoutAmount, 0n);
  const settledVolume = bounties
    .filter((bounty) => bounty.status === 4)
    .reduce((sum, bounty) => sum + bounty.payoutAmount, 0n);
  const largestOpenReward = openBounties.reduce(
    (maxValue, bounty) => (bounty.payoutAmount > maxValue ? bounty.payoutAmount : maxValue),
    0n
  );
  const averageOpenReward =
    openBounties.length === 0
      ? 0n
      : openBounties.reduce((sum, bounty) => sum + bounty.payoutAmount, 0n) / BigInt(openBounties.length);
  const sponsorMap = buildSponsorStatsMap(bounties);

  const sponsorLeaders = [...sponsorMap.values()]
    .sort((left, right) => {
      if (left.settledCount === right.settledCount) {
        if (left.totalPaidOut === right.totalPaidOut) {
          return right.totalCreated - left.totalCreated;
        }

        return left.totalPaidOut > right.totalPaidOut ? -1 : 1;
      }

      return right.settledCount - left.settledCount;
    })
    .slice(0, 3)
    .map((entry) => ({
      creator: entry.creator,
      totalCreated: entry.totalCreated,
      settledCount: entry.settledCount,
      liveCount: entry.liveCount,
      totalPaidOutUsdc: formatUsdcValue(entry.totalPaidOut)
    }));

  const hottestOpenBounties = openBounties
    .map((bounty) => {
      const sponsor = sponsorMap.get(bounty.creator.toLowerCase());
      const hoursLeft = Math.max(0, (Number(bounty.claimDeadline) * 1000 - Date.now()) / 3_600_000);
      let reason = "Fastest open path";

      if (Number(bounty.payoutAmount) / 1_000_000 >= 0.9) {
        reason = "Highest visible reward";
      } else if (hoursLeft <= 12) {
        reason = "Closes soon";
      } else if ((sponsor?.settledCount ?? 0) >= 1) {
        reason = "Backed by a settled sponsor";
      }

      return {
        id: bounty.id.toString(),
        title: bounty.title,
        rewardUsdc: formatUsdcValue(bounty.payoutAmount),
        closesIn: describeTimeLeft(bounty.claimDeadline),
        sponsor: bounty.creator,
        contact: bounty.contact,
        reason,
        score: rankOpenBountyScore(bounty, sponsor)
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      rewardUsdc: entry.rewardUsdc,
      closesIn: entry.closesIn,
      sponsor: entry.sponsor,
      contact: entry.contact,
      reason: entry.reason
    }));

  const reviewItems = reviewQueue
    .sort((left, right) => {
      if (left.reviewDeadline === right.reviewDeadline) {
        return Number(right.id - left.id);
      }

      return left.reviewDeadline < right.reviewDeadline ? -1 : 1;
    })
    .slice(0, 4)
    .map((bounty) => ({
      id: bounty.id.toString(),
      title: bounty.title,
      status: toStatusLabel(bounty.status),
      creator: bounty.creator,
      claimant: bounty.claimant,
      agentId: bounty.agentId > 0n ? bounty.agentId.toString() : null,
      lockedRewardUsdc: formatUsdcValue(bounty.payoutAmount),
      actionNeeded: getReviewActionLabel(bounty.status)
    }));

  const operatorNotes: string[] = [];

  if (openBounties.length > 0) {
    operatorNotes.push(
      `${openBounties.length} open bounties are currently available, with rewards up to ${formatUsdcValue(largestOpenReward)} USDC.`
    );
  }

  if (reviewQueue.length > 0) {
    operatorNotes.push(
      `${reviewQueue.length} tasks are still review-locked, so sponsor feedback remains the main payout bottleneck.`
    );
  }

  if (disputedCount > 0) {
    operatorNotes.push(
      `${disputedCount} dispute${disputedCount === 1 ? " is" : "s are"} freezing escrow until a decentralized resolution lane ships.`
    );
  }

  if (operatorNotes.length === 0) {
    operatorNotes.push("The visible board is clean right now: no review backlog and no disputes are blocking flow.");
  }

  return {
    mode: "premium",
    product: nanopaymentProductName,
    generatedAt: new Date().toISOString(),
    network: "Arc Testnet",
    contract: resolveBountyBoardAddress(),
    endpoint: nanopaymentMarketSignalEndpoint,
    price: nanopaymentMarketSignalPrice,
    coverage: {
      visibleBounties: bounties.length,
      openCount: openBounties.length,
      reviewQueueCount: reviewQueue.length,
      disputedCount
    },
    liquidity: {
      liveEscrowUsdc: formatUsdcValue(liveEscrow),
      settledVolumeUsdc: formatUsdcValue(settledVolume),
      averageOpenRewardUsdc: formatUsdcValue(averageOpenReward),
      largestOpenRewardUsdc: formatUsdcValue(largestOpenReward)
    },
    sponsorLeaders,
    hottestOpenBounties,
    reviewQueue: reviewItems,
    operatorNote: operatorNotes.join(" ")
  };
}

function buildIntakeBriefPreviewPayload(): IntakeBriefPreviewPayload {
  return {
    mode: "preview",
    product: nanopaymentIntakeBriefProductName,
    endpoint: nanopaymentIntakeBriefEndpoint,
    price: nanopaymentIntakeBriefPrice,
    network: "Arc Testnet via Circle Gateway",
    settlement: "Gas-free micropayment settlement through Circle Gateway and x402 on Arc Testnet.",
    description:
      "Pay for a machine-readable brief on a specific bounty, including sponsor context, claimability hints, and a webhook-ready automation envelope.",
    targetHint:
      "Pass ?bountyId=<id> and optionally ?agentId=<erc8004 id>. If no bountyId is supplied, the server falls back to the strongest currently open match.",
    includes: [
      "A focused bounty brief with deadlines, reward, and contact lane",
      "Server-side sponsor context not fully surfaced in the public board cards",
      "Claim readiness hints and a recommended opening move for the agent",
      "A webhook-ready payload you can post into an intake queue"
    ],
    docs: nanopaymentDocs.map((entry) => ({
      label: entry.label,
      url: entry.url
    }))
  };
}

function parseOptionalNumericString(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function selectIntakeTarget(
  bounties: BountyView[],
  requestedBountyId: string | null,
  sponsorMap: Map<string, SponsorStats>
) {
  if (requestedBountyId) {
    const exactMatch = bounties.find((bounty) => bounty.id.toString() === requestedBountyId);

    if (exactMatch) {
      return {
        bounty: exactMatch,
        wasFallback: false
      };
    }
  }

  const fallbackCandidate =
    [...bounties]
      .filter((bounty) => bounty.status === 0)
      .sort(
        (left, right) =>
          rankOpenBountyScore(right, sponsorMap.get(right.creator.toLowerCase())) -
          rankOpenBountyScore(left, sponsorMap.get(left.creator.toLowerCase()))
      )[0] ?? bounties[0];

  if (!fallbackCandidate) {
    throw new Error("No visible bounties are available for the intake brief feed.");
  }

  return {
    bounty: fallbackCandidate,
    wasFallback: true
  };
}

function buildIntakeBriefPremiumPayload(
  bounties: BountyView[],
  requestedBountyId: string | null,
  requestedAgentId: string | null
): IntakeBriefPremiumPayload {
  const sponsorMap = buildSponsorStatsMap(bounties);
  const { bounty, wasFallback } = selectIntakeTarget(bounties, requestedBountyId, sponsorMap);
  const sponsorStats = sponsorMap.get(bounty.creator.toLowerCase());
  const sponsorScore = Math.min(
    98,
    Math.max(42, 42 + (sponsorStats?.settledCount ?? 0) * 12 + (sponsorStats?.totalCreated ?? 0) * 3 - (sponsorStats?.liveCount ?? 0))
  );
  const trustTier =
    sponsorScore >= 82 ? "High-trust sponsor" : sponsorScore >= 68 ? "Established sponsor" : "Emerging sponsor";
  const likelyReviewSpeed =
    (sponsorStats?.settledCount ?? 0) >= 2
      ? "Likely to review quickly based on visible settled flow"
      : (sponsorStats?.totalCreated ?? 0) >= 2
        ? "Moderate review reliability with visible board activity"
        : "Review speed is still uncertain because the sponsor is new";

  let blocker: string | null = null;
  let recommendedAction = "Prepare the opening message, claim with your Arc agent, and mirror the brief into your intake queue.";
  const checklist = [
    "Verify that the reward size and deadline fit your current queue.",
    "Open the in-app discussion lane right after claiming so the sponsor does not need to chase you elsewhere.",
    "Mirror the webhook envelope into your agent runtime before work starts."
  ];

  if (bounty.status !== 0) {
    blocker = `This bounty is currently ${toStatusLabel(bounty.status).toLowerCase()}, so a fresh claim is not available.`;
    recommendedAction = "Track the thread, monitor review state, and only re-enter once the bounty returns to an open or actionable state.";
    checklist.unshift("Do not attempt a new claim while the bounty is outside the open state.");
  } else if (requestedAgentId) {
    recommendedAction = `Use agent #${requestedAgentId} for the claim, then send the sponsor a short kickoff note immediately.`;
    checklist.unshift(`Bind this brief to agent #${requestedAgentId} in your agent runtime so the intake stays attributable.`);
  }

  if (bounty.status === 5) {
    blocker = "The bounty is disputed, so escrow is frozen until the future decentralized resolution layer exists.";
  }

  if (bounty.status === 3) {
    blocker = "The current claimant has changes requested, so this brief is useful for monitoring but not for a fresh claim.";
  }

  const currentLoad =
    (sponsorStats?.liveCount ?? 0) >= 4
      ? "Sponsor is carrying multiple live bounties, so expect concise communication."
      : (sponsorStats?.liveCount ?? 0) >= 2
        ? "Sponsor has some active load but should still be reachable."
        : "Sponsor load looks light, which usually supports faster kickoff.";
  const openingAngle =
    requestedAgentId
      ? `Lead with agent #${requestedAgentId}, confirm the delivery format, and ask one deadline question before starting.`
      : "Lead with your intended delivery format, confirm the result URI structure, and ask one deadline question before starting.";

  return {
    mode: "premium",
    product: nanopaymentIntakeBriefProductName,
    generatedAt: new Date().toISOString(),
    network: "Arc Testnet",
    contract: resolveBountyBoardAddress(),
    endpoint: nanopaymentIntakeBriefEndpoint,
    price: nanopaymentIntakeBriefPrice,
    targeting: {
      requestedBountyId,
      selectedBountyId: bounty.id.toString(),
      wasFallback,
      requestedAgentId
    },
    selectedBounty: {
      id: bounty.id.toString(),
      title: bounty.title,
      status: toStatusLabel(bounty.status),
      summary: bounty.summary,
      rewardUsdc: formatUsdcValue(bounty.payoutAmount),
      claimWindow: describeTimeLeft(bounty.claimDeadline),
      submissionWindowHours: bounty.submissionWindow / 3600,
      reviewWindowHours: bounty.reviewWindow / 3600,
      creator: bounty.creator,
      claimant: bounty.claimant === "0x0000000000000000000000000000000000000000" ? null : bounty.claimant,
      agentId: bounty.agentId > 0n ? bounty.agentId.toString() : null,
      contact: bounty.contact
    },
    claimReadiness: {
      canClaimNow: bounty.status === 0,
      blocker,
      recommendedAction,
      checklist
    },
    privateSponsorContext: {
      trustTier,
      sponsorScore,
      settlementHistory: sponsorStats
        ? `${sponsorStats.settledCount} settled out of ${sponsorStats.totalCreated} visible bounties, with ${formatUsdcValue(sponsorStats.totalPaidOut)} USDC already paid out.`
        : "No settled sponsor history is visible yet on the board.",
      currentLoad,
      likelyReviewSpeed,
      openingAngle
    },
    webhookEnvelope: {
      event: "bounty.intake.brief.ready",
      dedupeKey: `brief-${bounty.id.toString()}-${requestedAgentId ?? "generic"}`,
      method: "POST",
      contentType: "application/json",
      targetPath: "/agent/intake-hooks/arc-bounty",
      samplePayload: {
        bountyId: bounty.id.toString(),
        title: bounty.title,
        rewardUsdc: formatUsdcValue(bounty.payoutAmount),
        requestedAgentId,
        recommendedAction,
        contact: bounty.contact
      }
    },
    automationHints: [
      "Use the dedupeKey when posting this brief into an intake queue so retries do not create duplicate tasks.",
      "Persist the sponsor score and likely review speed alongside the bounty so agent prioritization can stay deterministic.",
      "If the sponsor asks for revisions later, reopen this brief and thread the updated status back into your webhook workflow."
    ]
  };
}

async function createGatewayHttpServer(
  endpoint: string,
  price: string,
  description: string,
  unpaidBodyFactory: () => Promise<unknown> | unknown
) {
  const server = new x402ResourceServer([
    new BatchFacilitatorClient({
      url: process.env.NANOPAYMENTS_FACILITATOR_URL ?? defaultFacilitatorUrl
    }) as unknown as FacilitatorClient
  ]);

  server.register("eip155:*", new GatewayEvmScheme() as Parameters<typeof server.register>[1]);

  const httpServer = new x402HTTPResourceServer(server, {
    [`GET ${endpoint}`]: {
      accepts: {
        scheme: "exact",
        network: `eip155:${arcTestnet.id}`,
        payTo: resolveSellerAddress(),
        price
      },
      description,
      mimeType: "application/json",
      unpaidResponseBody: async () => ({
        contentType: "application/json",
        body: await unpaidBodyFactory()
      })
    }
  });

  await httpServer.initialize();
  return httpServer;
}

export function createNanopaymentRequestContext(adapter: HTTPAdapter, path: string, method: string): HTTPRequestContext {
  return {
    adapter,
    path,
    method,
    paymentHeader: adapter.getHeader("PAYMENT-SIGNATURE") ?? adapter.getHeader("X-PAYMENT")
  };
}

export async function getMarketSignalHttpServer() {
  if (!marketSignalServerPromise) {
    marketSignalServerPromise = createGatewayHttpServer(
      nanopaymentMarketSignalEndpoint,
      process.env.NANOPAYMENTS_MARKET_SIGNAL_PRICE ?? nanopaymentMarketSignalPrice,
      "Premium Arc board intelligence for agents, sponsors, and operators.",
      () => buildMarketSignalPreviewPayload()
    );
  }

  return marketSignalServerPromise;
}

export async function getIntakeBriefHttpServer() {
  if (!intakeBriefServerPromise) {
    intakeBriefServerPromise = createGatewayHttpServer(
      nanopaymentIntakeBriefEndpoint,
      process.env.NANOPAYMENTS_INTAKE_BRIEF_PRICE ?? nanopaymentIntakeBriefPrice,
      "Focused Arc bounty brief for agent-to-agent intake automation.",
      () => buildIntakeBriefPreviewPayload()
    );
  }

  return intakeBriefServerPromise;
}

export async function getPremiumMarketSignalPayload() {
  const bounties = await readVisibleBounties();
  return buildMarketSignalPremiumPayload(bounties);
}

export async function getPremiumIntakeBriefPayload(input: { bountyId?: string | null; agentId?: string | null }) {
  const bounties = await readVisibleBounties();
  return buildIntakeBriefPremiumPayload(
    bounties,
    parseOptionalNumericString(input.bountyId ?? undefined),
    parseOptionalNumericString(input.agentId ?? undefined)
  );
}
