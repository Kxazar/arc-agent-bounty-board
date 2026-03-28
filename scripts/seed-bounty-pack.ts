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

const seedBounties = [
  {
    title: "Summarize Discord onboarding feedback",
    summary: "Review a short batch of onboarding notes and turn them into three product fixes.",
    contact: "marin.ops",
    reward: "0.65"
  },
  {
    title: "Draft a support macro pack",
    summary: "Write five concise support replies for recurring account and wallet questions.",
    contact: "juno.handle",
    reward: "0.55"
  },
  {
    title: "Tag ecosystem partner leads",
    summary: "Sort a lightweight partner sheet into warm, cold, and follow-up buckets.",
    contact: "nadiya.pm",
    reward: "0.45"
  },
  {
    title: "Write release note summary",
    summary: "Convert engineering notes into a readable changelog for community posting.",
    contact: "tomas.grid",
    reward: "0.75"
  },
  {
    title: "Map agent test scenarios",
    summary: "Prepare a compact list of edge cases for claim, submit, timeout, and payout flows.",
    contact: "mika.signal",
    reward: "0.95"
  },
  {
    title: "Review faucet UX issues",
    summary: "Aggregate faucet friction reports and highlight the top three user blockers.",
    contact: "leon.arc",
    reward: "0.6"
  },
  {
    title: "Prepare bounty quality rubric",
    summary: "Turn sponsor expectations into a six-point acceptance checklist for reviewers.",
    contact: "rhea.tasks",
    reward: "0.35"
  },
  {
    title: "Cluster community questions",
    summary: "Group the latest community questions into themes and attach response suggestions.",
    contact: "dario.loop",
    reward: "0.8"
  },
  {
    title: "Draft validator feedback prompts",
    summary: "Create short feedback prompt options for post-payout reputation notes.",
    contact: "selin.mesh",
    reward: "0.5"
  },
  {
    title: "Turn bounty notes into FAQ",
    summary: "Convert raw sponsor notes into a short FAQ for new claimants entering the board.",
    contact: "kian.field",
    reward: "0.7"
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

  const payouts = seedBounties.map((item) => parseUnits(item.reward, 6));
  const totalPayout = payouts.reduce((sum, value) => sum + value, 0n);

  const balance = (await publicClient.readContract({
    address: stablecoin,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address]
  })) as bigint;

  if (balance < totalPayout) {
    throw new Error(`Not enough ERC-20 USDC to seed the bounty pack. Balance: ${balance.toString()}`);
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

  for (const [index, bounty] of seedBounties.entries()) {
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
        24 * 3600,
        48 * 3600,
        24 * 3600
      ],
      maxFeePerGas,
      maxPriorityFeePerGas,
      account
    });

    await publicClient.waitForTransactionReceipt({ hash: createHash });
    console.log(`${index + 1}. ${bounty.title}`);
    console.log(`   tx: ${arcTestnet.blockExplorers.default.url}/tx/${createHash}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
