import { BatchFacilitatorClient, GatewayEvmScheme } from "@circle-fin/x402-batching/server";
import { x402HTTPResourceServer, type HTTPAdapter, type HTTPRequestContext } from "@x402/core/http";
import { x402ResourceServer, type FacilitatorClient } from "@x402/core/server";
import { createPublicClient, http, isAddress, type Address } from "viem";

import type { BountyView } from "@/components/bounty-board-types";
import { arcBountyBoardAbi } from "@/lib/abi";
import { arcTestnet } from "@/lib/arc";
import type { BountyResult } from "@/lib/agent-tools";
import {
  nanopaymentDocs,
  nanopaymentMarketSignalEndpoint,
  nanopaymentMarketSignalPrice,
  nanopaymentProductName,
  type MarketSignalPremiumPayload,
  type MarketSignalPreviewPayload
} from "@/lib/nanopayments-shared";
import { mapBounty, visibleBountyCount } from "@/hooks/bounty-board-shared";

const fallbackSellerAddress = "0x58092111F88273F1E08445712A26B82099a99438";
const defaultFacilitatorUrl = "https://gateway-api-testnet.circle.com";
const visibleReviewStatuses = new Set([2, 3, 5]);
const visibleEscrowStatuses = new Set([0, 1, 2, 3, 5]);

let marketSignalServerPromise: Promise<x402HTTPResourceServer> | null = null;

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

function buildPreviewPayload(): MarketSignalPreviewPayload {
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

function buildPremiumPayload(bounties: BountyView[]): MarketSignalPremiumPayload {
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

  const sponsorMap = new Map<
    string,
    {
      creator: string;
      totalCreated: number;
      settledCount: number;
      liveCount: number;
      totalPaidOut: bigint;
    }
  >();

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
      const rewardScore = Number(bounty.payoutAmount) / 1_000_000;
      const hoursLeft = Math.max(0, (Number(bounty.claimDeadline) * 1000 - Date.now()) / 3_600_000);
      const score =
        rewardScore * 100 +
        (hoursLeft <= 12 ? 32 : hoursLeft <= 24 ? 18 : hoursLeft <= 72 ? 8 : 0) +
        (sponsor?.settledCount ?? 0) * 14;

      let reason = "Fastest open path";

      if (rewardScore >= 0.9) {
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
        score
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
    marketSignalServerPromise = (async () => {
      const server = new x402ResourceServer([
        new BatchFacilitatorClient({
          url: process.env.NANOPAYMENTS_FACILITATOR_URL ?? defaultFacilitatorUrl
        }) as unknown as FacilitatorClient
      ]);

      server.register("eip155:*", new GatewayEvmScheme() as Parameters<typeof server.register>[1]);

      const httpServer = new x402HTTPResourceServer(server, {
        [`GET ${nanopaymentMarketSignalEndpoint}`]: {
          accepts: {
            scheme: "exact",
            network: `eip155:${arcTestnet.id}`,
            payTo: resolveSellerAddress(),
            price: process.env.NANOPAYMENTS_MARKET_SIGNAL_PRICE ?? nanopaymentMarketSignalPrice
          },
          description: "Premium Arc board intelligence for agents, sponsors, and operators.",
          mimeType: "application/json",
          unpaidResponseBody: async () => ({
            contentType: "application/json",
            body: buildPreviewPayload()
          })
        }
      });

      await httpServer.initialize();
      return httpServer;
    })();
  }

  return marketSignalServerPromise;
}

export async function getPremiumMarketSignalPayload() {
  const bounties = await readVisibleBounties();
  return buildPremiumPayload(bounties);
}
