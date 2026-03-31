import { isAddress } from "viem";

import type {
  TreasuryBalance,
  TreasuryChainKey,
  TreasuryEvent,
  TreasuryMode,
  TreasuryPersistenceBackend,
  TreasurySnapshot,
  TreasurySourceChain
} from "@/lib/treasury-types";

export const MAX_EVENTS = 12;
export const MAX_SESSIONS = 8;

export const ARC_TREASURY_CHAIN = {
  bridgeChain: "Arc_Testnet",
  chainKey: "arc",
  chainLabel: "Arc Testnet",
  circleBlockchain: "ARC-TESTNET"
} as const;

export const SOURCE_CHAIN_CONFIG: Record<
  TreasurySourceChain,
  {
    bridgeChain: "Base_Sepolia" | "Ethereum_Sepolia";
    chainKey: Exclude<TreasuryChainKey, "arc">;
    chainLabel: TreasurySourceChain;
    circleBlockchain: "BASE-SEPOLIA" | "ETH-SEPOLIA";
    walletAddressField: "base_wallet_address" | "ethereum_wallet_address";
    walletIdField: "base_wallet_id" | "ethereum_wallet_id";
  }
> = {
  "Base Sepolia": {
    bridgeChain: "Base_Sepolia",
    chainKey: "base-sepolia",
    chainLabel: "Base Sepolia",
    circleBlockchain: "BASE-SEPOLIA",
    walletAddressField: "base_wallet_address",
    walletIdField: "base_wallet_id"
  },
  "Ethereum Sepolia": {
    bridgeChain: "Ethereum_Sepolia",
    chainKey: "ethereum-sepolia",
    chainLabel: "Ethereum Sepolia",
    circleBlockchain: "ETH-SEPOLIA",
    walletAddressField: "ethereum_wallet_address",
    walletIdField: "ethereum_wallet_id"
  }
};

export type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

export type CookieWriter = {
  set: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      sameSite: "lax";
      secure: boolean;
      path: string;
      maxAge: number;
    }
  ) => void;
};

export function normalizeWallet(wallet: string) {
  return wallet.trim().toLowerCase();
}

export function assertWallet(wallet: string) {
  if (!isAddress(wallet)) {
    throw new Error("A valid sponsor wallet address is required.");
  }
}

export function clampRecent<T>(items: T[], max: number) {
  return items.slice(0, max);
}

export function formatSixDecimals(value: bigint) {
  const whole = value / 1_000_000n;
  const fractional = value % 1_000_000n;

  if (fractional === 0n) {
    return whole.toString();
  }

  return `${whole.toString()}.${fractional.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

export function parseUsdcAmount(input: string) {
  const normalized = input.trim();

  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new Error("Enter a valid USDC amount with up to 6 decimals.");
  }

  const [whole, fractional = ""] = normalized.split(".");
  const fractionalPadded = `${fractional}000000`.slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(fractionalPadded);
}

export function addUsdc(left: string, right: string) {
  return formatSixDecimals(parseUsdcAmount(left) + parseUsdcAmount(right));
}

export function subtractUsdc(left: string, right: string) {
  const result = parseUsdcAmount(left) - parseUsdcAmount(right);

  if (result < 0n) {
    throw new Error("Treasury Arc balance is too low for this withdrawal.");
  }

  return formatSixDecimals(result);
}

export function buildBalance(input: {
  chainKey: TreasuryChainKey;
  chainLabel: string;
  amount: string;
  walletAddress?: string | null;
}): TreasuryBalance {
  return {
    chainKey: input.chainKey,
    chainLabel: input.chainLabel,
    asset: "USDC",
    amount: input.amount,
    walletAddress: input.walletAddress ?? null
  };
}

export function buildArcBalance(amount: string, walletAddress?: string | null) {
  return buildBalance({
    chainKey: ARC_TREASURY_CHAIN.chainKey,
    chainLabel: ARC_TREASURY_CHAIN.chainLabel,
    amount,
    walletAddress
  });
}

export function createEmptySnapshot(input: {
  mode: TreasuryMode;
  ownerWallet: string;
  persistenceBackend: TreasuryPersistenceBackend;
}): TreasurySnapshot {
  return {
    mode: input.mode,
    persistenceBackend: input.persistenceBackend,
    ownerWallet: input.ownerWallet,
    status: "not_created",
    circleWalletLabel: null,
    arcWalletAddress: null,
    availableArcUsdc: "0",
    totalFundedUsdc: "0",
    totalWithdrawnUsdc: "0",
    depositAddress: null,
    lastSourceChain: null,
    balances: [buildArcBalance("0")],
    events: [],
    sessions: []
  };
}

export function createEvent(input: Omit<TreasuryEvent, "id" | "createdAt">): TreasuryEvent {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input
  };
}

export function sanitizeForJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item))
  ) as T;
}
