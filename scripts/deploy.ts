import { readFile, writeFile } from "node:fs/promises";
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

import { arcTestnet } from "../lib/arc";
import { compileArcBountyBoard } from "./lib/compile-arc-bounty-board";

const DEFAULTS = {
  rpcUrl: "https://rpc.testnet.arc.network",
  stablecoin: "0x3600000000000000000000000000000000000000",
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
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

function requireAddress(value: string, label: string) {
  if (!isAddress(value)) {
    throw new Error(`${label} is not a valid address: ${value}`);
  }

  return value as Address;
}

async function upsertEnvLocal(address: Address) {
  const envLocalPath = path.join(process.cwd(), ".env.local");
  let content = "";

  try {
    content = await readFile(envLocalPath, "utf8");
  } catch {
    content = "";
  }

  const line = `NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS=${address}`;

  if (content.includes("NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS=")) {
    content = content.replace(/^NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS=.*$/m, line);
  } else {
    const separator = content.length === 0 || content.endsWith("\n") ? "" : "\n";
    content = `${content}${separator}${line}\n`;
  }

  await writeFile(envLocalPath, content, "utf8");
}

async function main() {
  loadEnvironment();

  const { artifact } = await compileArcBountyBoard();
  const privateKey = requireHexEnv("ARC_PRIVATE_KEY");
  const rpcUrl = process.env.ARC_RPC_URL ?? DEFAULTS.rpcUrl;
  const stablecoin = requireAddress(process.env.ARC_USDC_ADDRESS ?? DEFAULTS.stablecoin, "ARC_USDC_ADDRESS");
  const identityRegistry = requireAddress(
    process.env.ARC_IDENTITY_REGISTRY_ADDRESS ?? DEFAULTS.identityRegistry,
    "ARC_IDENTITY_REGISTRY_ADDRESS"
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

  console.log(`Deploying ${artifact.contractName} from ${account.address}`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`USDC: ${stablecoin}`);
  console.log(`IdentityRegistry: ${identityRegistry}`);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [stablecoin, identityRegistry],
    maxFeePerGas,
    maxPriorityFeePerGas
  });

  console.log(`Deployment tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress;

  if (!contractAddress) {
    throw new Error("Deployment receipt did not include a contract address.");
  }

  await upsertEnvLocal(contractAddress);

  console.log(`Contract deployed at ${contractAddress}`);
  console.log(`Explorer: ${arcTestnet.blockExplorers.default.url}/address/${contractAddress}`);
  console.log("Updated .env.local with NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
