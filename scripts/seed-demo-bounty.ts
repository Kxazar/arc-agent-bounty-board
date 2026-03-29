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
import { singleMilestonePlan } from "./lib/milestone-plan";

const DEFAULTS = {
  rpcUrl: "https://rpc.testnet.arc.network",
  stablecoin: "0x3600000000000000000000000000000000000000",
  maxFeeGwei: "160",
  maxPriorityFeeGwei: "2"
} as const;

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

function buildDemoMetadataUri() {
  const payload = {
    title: "Summarize 10 support tickets",
    summary: "Review ten support tickets and produce a concise summary with three action items.",
    contact: "discord:alexe",
    category: "support-ops",
    createdAt: new Date().toISOString()
  };

  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload))}`;
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

  const payoutAmount = parseUnits("5", 6);
  const balance = await publicClient.readContract({
    address: stablecoin,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address]
  });

  if (balance < payoutAmount) {
    throw new Error(`Not enough ERC-20 USDC to seed a demo bounty. Balance: ${balance.toString()}`);
  }

  const allowance = await publicClient.readContract({
    address: stablecoin,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, boardAddress]
  });

  if (allowance < payoutAmount) {
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

  const createHash = await walletClient.writeContract({
    address: boardAddress,
    abi: arcBountyBoardAbi,
    functionName: "createBounty",
    args: [
      buildDemoMetadataUri(),
      payoutAmount,
      24 * 3600,
      48 * 3600,
      24 * 3600,
      singleMilestonePlan(payoutAmount).milestoneAmounts,
      singleMilestonePlan(payoutAmount).milestoneCount
    ],
    maxFeePerGas,
    maxPriorityFeePerGas,
    account
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

  console.log(`Created demo bounty from ${account.address}`);
  console.log(`Create tx: ${arcTestnet.blockExplorers.default.url}/tx/${createHash}`);
  console.log(`Block: ${receipt.blockNumber.toString()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
