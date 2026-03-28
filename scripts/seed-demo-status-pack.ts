import path from "node:path";

import { config as loadEnv } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  maxUint256,
  parseGwei,
  parseUnits,
  type Address
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { arcBountyBoardAbi, erc20Abi, identityRegistryAbi } from "../lib/abi";
import { ARC_CONTRACTS, arcTestnet } from "../lib/arc";
import { buildBountyNoteUri, buildMessageUri, buildMetadataUri, readOwnedAgents } from "../lib/agent-tools";

const DEFAULTS = {
  rpcUrl: "https://rpc.testnet.arc.network",
  stablecoin: "0x3600000000000000000000000000000000000000",
  maxFeeGwei: "160",
  maxPriorityFeeGwei: "2"
} as const;

const statusPack = [
  {
    title: "Open demo | audit one sponsor note",
    summary: "A clean open task kept untouched so the board always has a simple open-state bounty for demos.",
    contact: "demo.sponsor",
    reward: "0.11",
    status: "open"
  },
  {
    title: "Submitted demo | check intake payload",
    summary: "A submitted task waiting on sponsor review so the review gate and timeout path are both easy to demonstrate.",
    contact: "demo.review",
    reward: "0.14",
    status: "submitted",
    resultUri: "https://example.com/arc-demo/submitted-intake-payload"
  },
  {
    title: "Revision demo | tighten bounty copy",
    summary: "A revision-requested task showing that payout does not move until the sponsor accepts the updated delivery.",
    contact: "demo.revise",
    reward: "0.16",
    status: "revision_requested",
    resultUri: "https://example.com/arc-demo/revision-pass-1",
    reviewNote: "Please tighten the summary and make the deliverable more compact before payout."
  },
  {
    title: "Dispute demo | resolve scope mismatch",
    summary: "A disputed task used to demonstrate frozen escrow and the future decentralized dispute lane in the roadmap.",
    contact: "demo.dispute",
    reward: "0.19",
    status: "disputed",
    resultUri: "https://example.com/arc-demo/dispute-brief",
    disputeNote: "Sponsor and claimant disagree on whether the original scope required a structured webhook payload."
  }
] as const;

function loadEnvironment() {
  loadEnv({ path: path.join(process.cwd(), ".env.local"), override: false, quiet: true });
  loadEnv({ path: path.join(process.cwd(), ".env"), override: false, quiet: true });
}

function requireHexEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name} in .env.local or .env`);
  }

  return value as `0x${string}`;
}

function requireAddress(value: string | undefined, label: string) {
  if (!value || !isAddress(value)) {
    throw new Error(`${label} is not a valid address.`);
  }

  return value as Address;
}

async function main() {
  loadEnvironment();

  const privateKey = requireHexEnv("ARC_PRIVATE_KEY");
  const rpcUrl = process.env.ARC_RPC_URL ?? DEFAULTS.rpcUrl;
  const stablecoin = requireAddress(process.env.ARC_USDC_ADDRESS ?? DEFAULTS.stablecoin, "ARC_USDC_ADDRESS");
  const identityRegistry = requireAddress(
    process.env.ARC_IDENTITY_REGISTRY_ADDRESS ?? ARC_CONTRACTS.identityRegistry,
    "ARC_IDENTITY_REGISTRY_ADDRESS"
  );
  const boardAddress = requireAddress(
    process.env.NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS,
    "NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS"
  );

  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl);
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport
  });
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport
  });

  let maxFeePerGas = parseGwei(process.env.ARC_MAX_FEE_GWEI ?? DEFAULTS.maxFeeGwei);
  let maxPriorityFeePerGas = parseGwei(DEFAULTS.maxPriorityFeeGwei);

  try {
    const estimatedFees = await publicClient.estimateFeesPerGas();

    if (estimatedFees.maxFeePerGas && estimatedFees.maxFeePerGas > maxFeePerGas) {
      maxFeePerGas = estimatedFees.maxFeePerGas;
    }

    if (estimatedFees.maxPriorityFeePerGas) {
      maxPriorityFeePerGas = estimatedFees.maxPriorityFeePerGas;
    }
  } catch {
    console.warn("Could not estimate fees from RPC. Using Arc-safe defaults.");
  }

  let ownedAgents = await readOwnedAgents(publicClient, account.address);

  if (ownedAgents.length === 0) {
    console.log("No owned Arc agent found. Registering a demo agent on IdentityRegistry...");

    const agentMetadataUri = `data:application/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify({
        name: "Arc Demo Task Agent",
        description: "Demo ERC-8004 identity used to seed realistic bounty states on Arc Testnet.",
        agent_type: "operations",
        capabilities: ["claiming", "submission", "discussion"],
        createdAt: new Date().toISOString()
      })
    )}`;

    const registerHash = await walletClient.writeContract({
      address: identityRegistry,
      abi: identityRegistryAbi,
      functionName: "register",
      args: [agentMetadataUri],
      maxFeePerGas,
      maxPriorityFeePerGas,
      account
    });

    await publicClient.waitForTransactionReceipt({ hash: registerHash });
    console.log(`   register tx: ${arcTestnet.blockExplorers.default.url}/tx/${registerHash}`);

    ownedAgents = await readOwnedAgents(publicClient, account.address);
  }

  if (ownedAgents.length === 0) {
    throw new Error("Agent registration did not produce a readable ERC-8004 identity for this wallet.");
  }

  const selectedAgentId = ownedAgents[0].agentId;
  const payouts = statusPack.map((item) => parseUnits(item.reward, 6));
  const totalPayout = payouts.reduce((sum, value) => sum + value, 0n);
  const balance = (await publicClient.readContract({
    address: stablecoin,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address]
  })) as bigint;

  if (balance < totalPayout) {
    throw new Error(`Not enough ERC-20 USDC to create the demo status pack. Balance: ${balance.toString()}`);
  }

  const allowance = (await publicClient.readContract({
    address: stablecoin,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, boardAddress]
  })) as bigint;

  if (allowance < totalPayout) {
    console.log("Approving USDC allowance for the bounty board...");

    const approveHash = await walletClient.writeContract({
      address: stablecoin,
      abi: erc20Abi,
      functionName: "approve",
      args: [boardAddress, maxUint256],
      maxFeePerGas,
      maxPriorityFeePerGas,
      account
    });

    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log(`Approve tx: ${arcTestnet.blockExplorers.default.url}/tx/${approveHash}`);
  }

  const nextBountyId = (await publicClient.readContract({
    address: boardAddress,
    abi: arcBountyBoardAbi,
    functionName: "nextBountyId"
  })) as bigint;

  console.log(`Using agent #${selectedAgentId.toString()} from ${account.address}`);

  for (const [index, bounty] of statusPack.entries()) {
    const bountyId = nextBountyId + BigInt(index);
    const createHash = await walletClient.writeContract({
      address: boardAddress,
      abi: arcBountyBoardAbi,
      functionName: "createBounty",
      args: [
        buildMetadataUri({
          title: bounty.title,
          summary: bounty.summary,
          contact: bounty.contact
        }),
        payouts[index],
        120 * 24 * 3600,
        48 * 3600,
        24 * 3600
      ],
      maxFeePerGas,
      maxPriorityFeePerGas,
      account
    });

    await publicClient.waitForTransactionReceipt({ hash: createHash });
    console.log(`#${bountyId.toString()} created (${bounty.status})`);
    console.log(`   create tx: ${arcTestnet.blockExplorers.default.url}/tx/${createHash}`);

    if (bounty.status === "open") {
      continue;
    }

    const claimHash = await walletClient.writeContract({
      address: boardAddress,
      abi: arcBountyBoardAbi,
      functionName: "claimBounty",
      args: [bountyId, selectedAgentId],
      maxFeePerGas,
      maxPriorityFeePerGas,
      account
    });

    await publicClient.waitForTransactionReceipt({ hash: claimHash });
    console.log(`   claim tx: ${arcTestnet.blockExplorers.default.url}/tx/${claimHash}`);

    const kickoffMessageHash = await walletClient.writeContract({
      address: boardAddress,
      abi: arcBountyBoardAbi,
      functionName: "postBountyMessage",
      args: [
        bountyId,
        buildMessageUri({
          text: `Kickoff note for demo state "${bounty.status}". Agent ${selectedAgentId.toString()} is aligned on the current task context.`
        })
      ],
      maxFeePerGas,
      maxPriorityFeePerGas,
      account
    });

    await publicClient.waitForTransactionReceipt({ hash: kickoffMessageHash });
    console.log(`   message tx: ${arcTestnet.blockExplorers.default.url}/tx/${kickoffMessageHash}`);

    const submitHash = await walletClient.writeContract({
      address: boardAddress,
      abi: arcBountyBoardAbi,
      functionName: "submitResult",
      args: [bountyId, bounty.resultUri],
      maxFeePerGas,
      maxPriorityFeePerGas,
      account
    });

    await publicClient.waitForTransactionReceipt({ hash: submitHash });
    console.log(`   submit tx: ${arcTestnet.blockExplorers.default.url}/tx/${submitHash}`);

    if (bounty.status === "submitted") {
      continue;
    }

    if (bounty.status === "revision_requested") {
      const requestChangesHash = await walletClient.writeContract({
        address: boardAddress,
        abi: arcBountyBoardAbi,
        functionName: "requestChanges",
        args: [
          bountyId,
          buildBountyNoteUri({
            kind: "changes_requested",
            note: bounty.reviewNote
          })
        ],
        maxFeePerGas,
        maxPriorityFeePerGas,
        account
      });

      await publicClient.waitForTransactionReceipt({ hash: requestChangesHash });
      console.log(`   revision tx: ${arcTestnet.blockExplorers.default.url}/tx/${requestChangesHash}`);
      continue;
    }

    if (bounty.status === "disputed") {
      const disputeHash = await walletClient.writeContract({
        address: boardAddress,
        abi: arcBountyBoardAbi,
        functionName: "openDispute",
        args: [
          bountyId,
          buildBountyNoteUri({
            kind: "dispute_opened",
            note: bounty.disputeNote
          })
        ],
        maxFeePerGas,
        maxPriorityFeePerGas,
        account
      });

      await publicClient.waitForTransactionReceipt({ hash: disputeHash });
      console.log(`   dispute tx: ${arcTestnet.blockExplorers.default.url}/tx/${disputeHash}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
