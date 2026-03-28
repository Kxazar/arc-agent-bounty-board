import path from "node:path";

import { config as loadEnv } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseGwei,
  type Address
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { arcBountyBoardAbi } from "../lib/abi";
import { arcTestnet } from "../lib/arc";

const DEFAULTS = {
  rpcUrl: "https://rpc.testnet.arc.network",
  maxFeeGwei: "160",
  maxPriorityFeeGwei: "2",
  claimWindowSeconds: 4 * 30 * 24 * 3_600
} as const;

type RawBounty = {
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
  const boardAddress = requireAddress(
    process.env.NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS,
    "NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS"
  );
  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport
  });
  const walletClient = createWalletClient({
    account,
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

  const nextBountyId = (await publicClient.readContract({
    address: boardAddress,
    abi: arcBountyBoardAbi,
    functionName: "nextBountyId"
  })) as bigint;

  if (nextBountyId === 0n) {
    console.log("No bounties found.");
    return;
  }

  console.log(`Scanning ${nextBountyId.toString()} bounty records on ${boardAddress}...`);
  const fourMonthsLabel = `${DEFAULTS.claimWindowSeconds / 86_400} days`;

  for (let bountyId = 0n; bountyId < nextBountyId; bountyId += 1n) {
    const bounty = (await publicClient.readContract({
      address: boardAddress,
      abi: arcBountyBoardAbi,
      functionName: "getBounty",
      args: [bountyId]
    })) as RawBounty;

    if (bounty.status !== 0) {
      console.log(`#${bountyId.toString()} skipped: status ${bounty.status}`);
      continue;
    }

    if (bounty.creator.toLowerCase() !== account.address.toLowerCase()) {
      console.log(`#${bountyId.toString()} skipped: creator mismatch (${bounty.creator})`);
      continue;
    }

    console.log(`#${bountyId.toString()} updating claim window to ${fourMonthsLabel}...`);

    const hash = await walletClient.writeContract({
      address: boardAddress,
      abi: arcBountyBoardAbi,
      functionName: "updateBounty",
      args: [
        bountyId,
        bounty.metadataURI,
        bounty.payoutAmount,
        DEFAULTS.claimWindowSeconds,
        bounty.submissionWindow,
        bounty.reviewWindow
      ],
      maxFeePerGas,
      maxPriorityFeePerGas,
      account
    });

    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`   tx: ${arcTestnet.blockExplorers.default.url}/tx/${hash}`);
  }

  console.log("Claim window extension complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
