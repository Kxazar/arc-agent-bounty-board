import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  keccak256,
  parseGwei,
  toHex,
  zeroAddress,
  type Address
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { arcBountyBoardAbi, identityRegistryAbi, reputationRegistryAbi } from "@/lib/abi";
import { ARC_CONTRACTS, arcTestnet } from "@/lib/arc";

type ReputationRequest = {
  bountyId?: number | string;
  score?: number;
  tag1?: string;
  tag2?: string;
  note?: string;
};

type BountyResult = {
  creator: Address;
  claimant: Address;
  agentId: bigint;
  payoutAmount: bigint;
  claimDeadline: bigint;
  submissionDeadline: bigint;
  reviewDeadline: bigint;
  submissionWindow: number;
  reviewWindow: number;
  status: number;
  metadataURI: string;
  resultURI: string;
};

const DEFAULT_SCORE = 95;
const DEFAULT_TAG1 = "successful_delivery";
const DEFAULT_TAG2 = "arc_bounty";

function requireAddress(value: string | undefined, label: string) {
  if (!value || !isAddress(value)) {
    throw new Error(`${label} is missing or invalid.`);
  }

  return value as Address;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ReputationRequest;
    const validatorKey = (process.env.ARC_VALIDATOR_PRIVATE_KEY ?? process.env.ARC_PRIVATE_KEY) as
      | `0x${string}`
      | undefined;

    if (!validatorKey) {
      return NextResponse.json(
        { error: "Missing ARC_VALIDATOR_PRIVATE_KEY or ARC_PRIVATE_KEY on the server." },
        { status: 500 }
      );
    }

    const bountyBoardAddress = requireAddress(
      process.env.NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS,
      "NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS"
    );
    const rpcUrl = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

    if (body.bountyId === undefined || body.bountyId === null) {
      return NextResponse.json({ error: "bountyId is required." }, { status: 400 });
    }

    const bountyId = BigInt(body.bountyId);
    const score = Math.max(0, Math.min(100, Math.round(body.score ?? DEFAULT_SCORE)));
    const tag1 = body.tag1?.trim() || DEFAULT_TAG1;
    const tag2 = body.tag2?.trim() || DEFAULT_TAG2;
    const note = body.note?.trim() || "Bounty approved and settled through Arc Agent Bounty Board.";

    const transport = http(rpcUrl);
    const account = privateKeyToAccount(validatorKey);
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport
    });
    const walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport
    });

    const bounty = (await publicClient.readContract({
      address: bountyBoardAddress,
      abi: arcBountyBoardAbi,
      functionName: "getBounty",
      args: [bountyId]
    })) as BountyResult;

    if (bounty.status !== 3) {
      return NextResponse.json(
        { error: "Reputation can only be recorded after a bounty reaches Approved." },
        { status: 400 }
      );
    }

    if (bounty.agentId === 0n || bounty.claimant === zeroAddress) {
      return NextResponse.json(
        { error: "This bounty has no claimed Arc agent, so there is no target for feedback." },
        { status: 400 }
      );
    }

    const agentOwner = (await publicClient.readContract({
      address: ARC_CONTRACTS.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "ownerOf",
      args: [bounty.agentId]
    })) as Address;

    if (agentOwner.toLowerCase() === account.address.toLowerCase()) {
      return NextResponse.json(
        { error: "The validator wallet cannot record reputation for its own agent." },
        { status: 400 }
      );
    }

    let maxFeePerGas = parseGwei(process.env.ARC_MAX_FEE_GWEI ?? "160");
    let maxPriorityFeePerGas = parseGwei("2");

    try {
      const estimatedFees = await publicClient.estimateFeesPerGas();

      if (estimatedFees.maxFeePerGas && estimatedFees.maxFeePerGas > maxFeePerGas) {
        maxFeePerGas = estimatedFees.maxFeePerGas;
      }

      if (estimatedFees.maxPriorityFeePerGas) {
        maxPriorityFeePerGas = estimatedFees.maxPriorityFeePerGas;
      }
    } catch {
      // fall back to Arc-safe defaults
    }

    const feedbackPayload = {
      source: "Arc Agent Bounty Board",
      bountyId: bountyId.toString(),
      agentId: bounty.agentId.toString(),
      payoutAmount: bounty.payoutAmount.toString(),
      score,
      note,
      resultURI: bounty.resultURI,
      recordedAt: new Date().toISOString()
    };

    const feedbackJson = JSON.stringify(feedbackPayload);
    const feedbackURI = `data:application/json;charset=utf-8,${encodeURIComponent(feedbackJson)}`;
    const feedbackHash = keccak256(toHex(feedbackJson));
    const endpoint = request.headers.get("origin") ?? arcTestnet.blockExplorers.default.url;

    const txHash = await walletClient.writeContract({
      address: ARC_CONTRACTS.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "giveFeedback",
      args: [bounty.agentId, BigInt(score), 0, tag1, tag2, endpoint, feedbackURI, feedbackHash],
      account,
      maxFeePerGas,
      maxPriorityFeePerGas
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return NextResponse.json({
      ok: true,
      bountyId: bountyId.toString(),
      agentId: bounty.agentId.toString(),
      score,
      txHash,
      explorerUrl: `${arcTestnet.blockExplorers.default.url}/tx/${txHash}`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record reputation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
