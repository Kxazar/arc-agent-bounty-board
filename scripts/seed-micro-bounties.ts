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

import { arcBountyBoardAbi, erc20Abi } from "../lib/abi";
import { arcTestnet } from "../lib/arc";
import { buildMetadataUri } from "../lib/agent-tools";

const DEFAULTS = {
  rpcUrl: "https://rpc.testnet.arc.network",
  stablecoin: "0x3600000000000000000000000000000000000000",
  maxFeeGwei: "160",
  maxPriorityFeeGwei: "2"
} as const;

const microBounties = [
  {
    title: "Rewrite one onboarding tooltip",
    summary: "Condense a verbose onboarding tooltip into one clear sentence for first-time claimants.",
    contact: "niko.growth",
    reward: "0.06"
  },
  {
    title: "Tag three support screenshots",
    summary: "Label three support screenshots with the main friction point and likely fix area.",
    contact: "lina.ops",
    reward: "0.08"
  },
  {
    title: "Draft one Discord reminder",
    summary: "Write a short reminder message for sponsors to review submitted work before timeout.",
    contact: "darin.flow",
    reward: "0.05"
  },
  {
    title: "Summarize faucet confusion notes",
    summary: "Turn a tiny set of faucet complaints into two user-facing takeaways and one product note.",
    contact: "mira.path",
    reward: "0.12"
  },
  {
    title: "Name three review states clearly",
    summary: "Suggest more intuitive labels for submitted, revision requested, and disputed states.",
    contact: "sol.pm",
    reward: "0.09"
  },
  {
    title: "Trim a sponsor brief",
    summary: "Shorten a raw sponsor description into a tighter summary that still preserves scope.",
    contact: "toma.queue",
    reward: "0.11"
  },
  {
    title: "Write claim success copy",
    summary: "Create one concise confirmation line shown after an agent successfully claims a bounty.",
    contact: "rune.layer",
    reward: "0.07"
  },
  {
    title: "Cluster five FAQ prompts",
    summary: "Group five repeated claimant questions into three FAQ themes for the board.",
    contact: "alina.arc",
    reward: "0.13"
  },
  {
    title: "Review one payout CTA",
    summary: "Suggest a cleaner button label for the final sponsor payout approval action.",
    contact: "karel.ops",
    reward: "0.04"
  },
  {
    title: "Draft escalation note",
    summary: "Write one calm dispute-escalation template for cases where scope alignment breaks down.",
    contact: "vera.grid",
    reward: "0.14"
  },
  {
    title: "Map creator follow-up step",
    summary: "Describe the single best next action a creator should take after a claimant opens discussion.",
    contact: "nadia.stack",
    reward: "0.1"
  },
  {
    title: "Label sponsor trust badge",
    summary: "Suggest one short badge name for sponsors with at least one completed settlement on Arc.",
    contact: "mert.signal",
    reward: "0.03"
  },
  {
    title: "Draft one webhook event name",
    summary: "Propose a clean event name for agent intake when a new bounty brief is ready to consume.",
    contact: "eira.proto",
    reward: "0.15"
  },
  {
    title: "Rewrite empty state copy",
    summary: "Refresh the empty-state message shown when no bounties match the current filters.",
    contact: "sena.board",
    reward: "0.05"
  },
  {
    title: "Check one intake checklist",
    summary: "Tighten a three-step intake checklist so it is easy for an autonomous agent to follow.",
    contact: "ilya.mesh",
    reward: "0.18"
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

  const payouts = microBounties.map((item) => parseUnits(item.reward, 6));
  const totalPayout = payouts.reduce((sum, value) => sum + value, 0n);
  const nextBountyId = (await publicClient.readContract({
    address: boardAddress,
    abi: arcBountyBoardAbi,
    functionName: "nextBountyId"
  })) as bigint;
  const balance = (await publicClient.readContract({
    address: stablecoin,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address]
  })) as bigint;

  console.log(`Board: ${boardAddress}`);
  console.log(`Seeder: ${account.address}`);
  console.log(`Starting bounty id: ${nextBountyId.toString()}`);
  console.log(`Wallet ERC-20 USDC balance: ${balance.toString()}`);
  console.log(`Required for micro-pack: ${totalPayout.toString()}`);

  if (balance < totalPayout) {
    throw new Error(`Not enough ERC-20 USDC to create the 15 micro bounties. Balance: ${balance.toString()}`);
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

  for (const [index, bounty] of microBounties.entries()) {
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
    console.log(`${Number(nextBountyId) + index}. ${bounty.title}`);
    console.log(`   tx: ${arcTestnet.blockExplorers.default.url}/tx/${createHash}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
