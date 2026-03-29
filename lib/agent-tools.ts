import { parseAbiItem, type Address, type PublicClient } from "viem";

import { identityRegistryAbi, reputationRegistryAbi } from "@/lib/abi";
import { ARC_CONTRACTS } from "@/lib/arc";

const recentAgentLookback = 40_000n;
const recentAgentChunk = 8_000n;
const messageLogChunk = 8_000n;

export type BountyResult = {
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
  milestoneAmounts: readonly [bigint, bigint, bigint];
  status: number;
  metadataURI: string;
  resultURI: string;
  reviewURI: string;
  disputeURI: string;
};

export type OwnedAgent = {
  agentId: bigint;
  name: string;
  description: string;
  tokenURI: string;
  metadataUrl: string | null;
};

export type ReputationSummary = {
  count: number;
  score: number | null;
  decimals: number;
};

export type BountyMessage = {
  bountyId: bigint;
  author: Address;
  createdAt: bigint;
  text: string;
  attachmentName: string | null;
  attachmentUrl: string | null;
  attachmentDataUrl: string | null;
};

type AgentMetadata = {
  name?: string;
  description?: string;
};

type BountyNotePayload = {
  kind?: string;
  note?: string;
  createdAt?: string;
};

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseEmbeddedJsonUri(uri: string) {
  if (!uri.startsWith("data:application/json")) {
    return null;
  }

  try {
    const jsonString = decodeURIComponent(uri.split(",", 2)[1] ?? "");
    return JSON.parse(jsonString) as Record<string, string>;
  } catch {
    return null;
  }
}

export function parseBountyMetadata(metadataURI: string) {
  const payload = parseEmbeddedJsonUri(metadataURI);

  if (!payload) {
    return null;
  }

  return {
    title: payload.title,
    summary: payload.summary,
    contact: payload.contact,
    milestoneSplit: payload.milestoneSplit
  };
}

export function buildMetadataUri(input: {
  title: string;
  summary: string;
  contact: string;
  milestoneSplit?: string;
}) {
  const payload = {
    title: input.title.trim(),
    summary: input.summary.trim(),
    contact: input.contact.trim(),
    milestoneSplit: input.milestoneSplit?.trim() || "100",
    category: "agentic-ops",
    createdAt: new Date().toISOString()
  };

  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload))}`;
}

export function buildBountyNoteUri(input: {
  kind: "review_passed" | "changes_requested" | "dispute_opened";
  note: string;
}) {
  const payload = {
    kind: input.kind,
    note: input.note.trim(),
    createdAt: new Date().toISOString()
  };

  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload))}`;
}

export function parseBountyNoteUri(uri: string) {
  const payload = parseEmbeddedJsonUri(uri) as BountyNotePayload | null;

  if (!payload) {
    return null;
  }

  return {
    kind: payload.kind ?? "",
    note: payload.note ?? ""
  };
}

export function buildMessageUri(input: {
  text: string;
  attachmentName?: string;
  attachmentUrl?: string;
  attachmentDataUrl?: string;
}) {
  const payload = {
    text: input.text,
    attachmentName: normalizeOptionalText(input.attachmentName),
    attachmentUrl: normalizeOptionalText(input.attachmentUrl),
    attachmentDataUrl: normalizeOptionalText(input.attachmentDataUrl),
    createdAt: new Date().toISOString()
  };

  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload))}`;
}

export function parseMessageUri(messageURI: string) {
  const payload = parseEmbeddedJsonUri(messageURI);

  if (!payload) {
    return null;
  }

  return {
    text: payload.text ?? "",
    attachmentName: payload.attachmentName ?? null,
    attachmentUrl: payload.attachmentUrl ?? null,
    attachmentDataUrl: payload.attachmentDataUrl ?? null
  };
}

export function toHttpUrl(uri: string) {
  const normalizedUri = uri.trim();

  if (normalizedUri.startsWith("http://") || normalizedUri.startsWith("https://")) {
    return normalizedUri;
  }

  if (normalizedUri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${normalizedUri.replace("ipfs://", "")}`;
  }

  return null;
}

async function readJsonMetadata(uri: string) {
  const embedded = parseEmbeddedJsonUri(uri);

  if (embedded) {
    return embedded as AgentMetadata;
  }

  const externalUrl = toHttpUrl(uri);

  if (!externalUrl) {
    return null;
  }

  try {
    const response = await fetch(externalUrl);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AgentMetadata;
  } catch {
    return null;
  }
}

export async function readReputationSummary(client: PublicClient, agentId: bigint): Promise<ReputationSummary> {
  const clients = (await client.readContract({
    address: ARC_CONTRACTS.reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: "getClients",
    args: [agentId]
  })) as Address[];

  if (clients.length === 0) {
    return {
      count: 0,
      score: null,
      decimals: 0
    };
  }

  const [count, summaryValue, summaryValueDecimals] = (await client.readContract({
    address: ARC_CONTRACTS.reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: "getSummary",
    args: [agentId, clients, "", ""]
  })) as readonly [bigint, bigint, number];

  const factor = 10 ** summaryValueDecimals;

  return {
    count: Number(count),
    score: Number(summaryValue) / factor,
    decimals: Number(summaryValueDecimals)
  };
}

export async function readOwnedAgents(client: PublicClient, owner: Address): Promise<OwnedAgent[]> {
  const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)");
  const latestBlock = await client.getBlockNumber();
  const fromBlock = latestBlock > recentAgentLookback ? latestBlock - recentAgentLookback : 0n;
  const tokenIds: string[] = [];

  for (let start = fromBlock; start <= latestBlock; start += recentAgentChunk + 1n) {
    const end = start + recentAgentChunk > latestBlock ? latestBlock : start + recentAgentChunk;
    const logs = await client.getLogs({
      address: ARC_CONTRACTS.identityRegistry,
      event: transferEvent,
      args: { to: owner },
      fromBlock: start,
      toBlock: end
    });

    for (const log of logs) {
      if (typeof log.args.tokenId === "bigint") {
        tokenIds.push(log.args.tokenId.toString());
      }
    }
  }

  const uniqueTokenIds = [...new Set(tokenIds.reverse())];
  const agents: OwnedAgent[] = [];

  for (const tokenIdString of uniqueTokenIds.slice(0, 6)) {
    const agentId = BigInt(tokenIdString);

    try {
      const currentOwner = (await client.readContract({
        address: ARC_CONTRACTS.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "ownerOf",
        args: [agentId]
      })) as Address;

      if (currentOwner.toLowerCase() !== owner.toLowerCase()) {
        continue;
      }

      const tokenURI = (await client.readContract({
        address: ARC_CONTRACTS.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "tokenURI",
        args: [agentId]
      })) as string;

      const metadata = await readJsonMetadata(tokenURI);
      agents.push({
        agentId,
        tokenURI,
        metadataUrl: toHttpUrl(tokenURI),
        name: metadata?.name ?? `Agent #${agentId.toString()}`,
        description: metadata?.description ?? "Arc ERC-8004 identity owned by the connected wallet."
      });
    } catch {
      // Skip unreadable agents.
    }
  }

  return agents;
}

export async function readBountyMessages(
  client: PublicClient,
  boardAddress: Address,
  bountyId: bigint
): Promise<BountyMessage[]> {
  const messageEvent = parseAbiItem(
    "event BountyMessagePosted(uint256 indexed bountyId, address indexed author, uint64 timestamp, string messageURI)"
  );
  const latestBlock = await client.getBlockNumber();
  const messages: BountyMessage[] = [];

  for (let start = 0n; start <= latestBlock; start += messageLogChunk + 1n) {
    const end = start + messageLogChunk > latestBlock ? latestBlock : start + messageLogChunk;
    const chunkLogs = await client.getLogs({
      address: boardAddress,
      event: messageEvent,
      args: { bountyId },
      fromBlock: start,
      toBlock: end
    });

    const chunkMessages = chunkLogs
      .map((log) => {
      if (
        typeof log.args.bountyId !== "bigint" ||
        typeof log.args.author !== "string" ||
        typeof log.args.timestamp !== "bigint" ||
        typeof log.args.messageURI !== "string"
      ) {
        return null;
      }

      const payload = parseMessageUri(log.args.messageURI);

      return {
        bountyId: log.args.bountyId,
        author: log.args.author as Address,
        createdAt: log.args.timestamp,
        text: payload?.text ?? log.args.messageURI,
        attachmentName: payload?.attachmentName ?? null,
        attachmentUrl: payload?.attachmentUrl ?? null,
        attachmentDataUrl: payload?.attachmentDataUrl ?? null
      } satisfies BountyMessage;
      })
      .filter((message): message is BountyMessage => message !== null);

    messages.push(...chunkMessages);
  }

  return messages;
}

export function formatReputation(summary: ReputationSummary | undefined) {
  if (!summary || summary.count === 0 || summary.score === null) {
    return "New agent";
  }

  return `${summary.score.toFixed(summary.decimals > 0 ? summary.decimals : 0)}/100`;
}
