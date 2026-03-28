import path from "node:path";

import { config as loadEnv } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseGwei,
  parseUnits,
  type Address
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { arcBountyBoardAbi } from "../lib/abi";
import { arcTestnet } from "../lib/arc";

const DEFAULTS = {
  rpcUrl: "https://rpc.testnet.arc.network",
  maxFeeGwei: "160",
  maxPriorityFeeGwei: "2"
} as const;

const legacyBountyIds = [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n] as const;
const rebalanceReward = parseUnits("0.05", 6);
const claimWindowSeconds = 120 * 24 * 3600;

type BountyResult = {
  creator: Address;
  claimant: Address;
  disputeRaisedBy: Address;
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
  reviewURI: string;
  disputeURI: string;
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

  let totalFreed = 0n;

  for (const bountyId of legacyBountyIds) {
    const bounty = (await publicClient.readContract({
      address: boardAddress,
      abi: arcBountyBoardAbi,
      functionName: "getBounty",
      args: [bountyId]
    })) as BountyResult;

    if (bounty.creator.toLowerCase() !== account.address.toLowerCase()) {
      console.log(`Skipping #${bountyId.toString()} because creator is different.`);
      continue;
    }

    if (bounty.status !== 0) {
      console.log(`Skipping #${bountyId.toString()} because status is ${bounty.status}, not Open.`);
      continue;
    }

    if (bounty.payoutAmount <= rebalanceReward) {
      console.log(`Skipping #${bountyId.toString()} because reward is already low enough.`);
      continue;
    }

    const refund = bounty.payoutAmount - rebalanceReward;
    const txHash = await walletClient.writeContract({
      address: boardAddress,
      abi: arcBountyBoardAbi,
      functionName: "updateBounty",
      args: [
        bountyId,
        bounty.metadataURI,
        rebalanceReward,
        claimWindowSeconds,
        bounty.submissionWindow,
        bounty.reviewWindow
      ],
      maxFeePerGas,
      maxPriorityFeePerGas,
      account
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });
    totalFreed += refund;

    console.log(`#${bountyId.toString()} rebalanced to 0.05 USDC`);
    console.log(`   freed: ${refund.toString()}`);
    console.log(`   tx: ${arcTestnet.blockExplorers.default.url}/tx/${txHash}`);
  }

  console.log(`Total freed (atomic USDC): ${totalFreed.toString()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
