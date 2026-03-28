import { defineChain, isAddress, type Address } from "viem";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.testnet.arc.network";
const configuredBountyBoardAddress = process.env.NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS;

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "USDC",
    symbol: "USDC"
  },
  rpcUrls: {
    default: {
      http: [rpcUrl]
    }
  },
  blockExplorers: {
    default: {
      name: "Arcscan",
      url: "https://testnet.arcscan.app"
    }
  },
  testnet: true
});

export const ARC_CONTRACTS = {
  usdc: "0x3600000000000000000000000000000000000000" as Address,
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as Address,
  reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as Address,
  validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272" as Address
};

export const deployedBountyBoardAddress = "0xb3deabedf68cfad45e87ea781cea1220a6d3d385" as Address;
export const bountyBoardAddress =
  configuredBountyBoardAddress && isAddress(configuredBountyBoardAddress)
    ? (configuredBountyBoardAddress as Address)
    : deployedBountyBoardAddress;
export const hasBountyBoardAddress = true;
