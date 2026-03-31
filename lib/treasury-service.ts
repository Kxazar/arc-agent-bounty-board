import { createHash, randomUUID } from "node:crypto";

import { isAddress } from "viem";

import type {
  TreasuryBalance,
  TreasuryEvent,
  TreasuryFundingSession,
  TreasuryResponse,
  TreasurySnapshot,
  TreasurySourceChain
} from "@/lib/treasury-types";

const COOKIE_PREFIX = "arc_treasury_demo_v1_";
const MAX_EVENTS = 12;
const MAX_SESSIONS = 8;

type CookieReader = {
  get: (name: string) => { value: string } | undefined;
};

type CookieWriter = {
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

function cookieNameForWallet(wallet: string) {
  return `${COOKIE_PREFIX}${wallet.toLowerCase()}`;
}

function clampRecent<T>(items: T[], max: number) {
  return items.slice(0, max);
}

function formatSixDecimals(value: bigint) {
  const whole = value / 1_000_000n;
  const fractional = value % 1_000_000n;

  if (fractional === 0n) {
    return whole.toString();
  }

  return `${whole.toString()}.${fractional.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

function parseUsdcAmount(input: string) {
  const normalized = input.trim();

  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new Error("Enter a valid USDC amount with up to 6 decimals.");
  }

  const [whole, fractional = ""] = normalized.split(".");
  const fractionalPadded = `${fractional}000000`.slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(fractionalPadded);
}

function makePseudoAddress(seed: string) {
  return `0x${createHash("sha256").update(seed).digest("hex").slice(0, 40)}`;
}

function buildArcBalance(amount: string): TreasuryBalance {
  return {
    chainKey: "arc",
    chainLabel: "Arc Testnet",
    asset: "USDC",
    amount
  };
}

function createEmptySnapshot(wallet: string): TreasurySnapshot {
  return {
    mode: "demo",
    ownerWallet: wallet,
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

function assertWallet(wallet: string) {
  if (!isAddress(wallet)) {
    throw new Error("A valid sponsor wallet address is required.");
  }
}

function parseSnapshot(raw: string | undefined, wallet: string) {
  if (!raw) {
    return createEmptySnapshot(wallet);
  }

  try {
    const parsed = JSON.parse(raw) as TreasurySnapshot;

    if (parsed.ownerWallet.toLowerCase() !== wallet.toLowerCase()) {
      return createEmptySnapshot(wallet);
    }

    return {
      ...parsed,
      balances: parsed.balances?.length ? parsed.balances : [buildArcBalance(parsed.availableArcUsdc ?? "0")],
      events: parsed.events ?? [],
      sessions: parsed.sessions ?? []
    };
  } catch {
    return createEmptySnapshot(wallet);
  }
}

function readSnapshot(store: CookieReader, wallet: string) {
  assertWallet(wallet);
  return parseSnapshot(store.get(cookieNameForWallet(wallet))?.value, wallet);
}

export function persistTreasurySnapshot(store: CookieWriter, snapshot: TreasurySnapshot) {
  store.set(cookieNameForWallet(snapshot.ownerWallet), JSON.stringify(snapshot), {
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

function createEvent(input: Omit<TreasuryEvent, "id" | "createdAt">): TreasuryEvent {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input
  };
}

function prependEvent(snapshot: TreasurySnapshot, event: TreasuryEvent) {
  snapshot.events = clampRecent([event, ...snapshot.events], MAX_EVENTS);
}

function upsertBalance(snapshot: TreasurySnapshot, amount: string) {
  snapshot.availableArcUsdc = amount;
  snapshot.balances = [buildArcBalance(amount)];
}

function addUsdc(left: string, right: string) {
  return formatSixDecimals(parseUsdcAmount(left) + parseUsdcAmount(right));
}

function subtractUsdc(left: string, right: string) {
  const result = parseUsdcAmount(left) - parseUsdcAmount(right);

  if (result < 0n) {
    throw new Error("Treasury Arc balance is too low for this withdrawal.");
  }

  return formatSixDecimals(result);
}

function createSession(sourceChain: TreasurySourceChain, amount: string, ownerWallet: string): TreasuryFundingSession {
  const id = randomUUID();

  return {
    id,
    sourceChain,
    targetChain: "Arc Testnet",
    amount,
    status: "address_issued",
    depositAddress: makePseudoAddress(`${ownerWallet}:${sourceChain}:${id}`),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function getTreasurySnapshot(store: CookieReader, wallet: string): TreasuryResponse {
  return { snapshot: readSnapshot(store, wallet) };
}

export function createTreasury(store: CookieReader, wallet: string): TreasuryResponse {
  const snapshot = readSnapshot(store, wallet);

  if (snapshot.status === "ready") {
    return { snapshot };
  }

  snapshot.status = "ready";
  snapshot.circleWalletLabel = `DCW-${wallet.slice(2, 6).toUpperCase()}`;
  snapshot.arcWalletAddress = makePseudoAddress(`${wallet}:arc`);
  prependEvent(
    snapshot,
    createEvent({
      kind: "treasury_created",
      status: "success",
      title: "Sponsor treasury created",
      detail: "A demo-safe managed treasury is ready for cross-chain funding into Arc."
    })
  );

  return { snapshot };
}

export function issueDepositAddress(
  store: CookieReader,
  wallet: string,
  sourceChain: TreasurySourceChain,
  amount: string
): TreasuryResponse {
  const snapshot = readSnapshot(store, wallet);

  if (snapshot.status !== "ready") {
    throw new Error("Create a sponsor treasury before requesting a deposit address.");
  }

  parseUsdcAmount(amount);

  const session = createSession(sourceChain, amount, wallet);
  snapshot.depositAddress = session.depositAddress;
  snapshot.lastSourceChain = sourceChain;
  snapshot.sessions = clampRecent([session, ...snapshot.sessions], MAX_SESSIONS);
  prependEvent(
    snapshot,
    createEvent({
      kind: "deposit_address_issued",
      status: "info",
      title: "Deposit address issued",
      detail: `${amount} USDC can now be routed from ${sourceChain} into your Arc treasury lane.`
    })
  );

  return { snapshot };
}

export function simulateBridge(
  store: CookieReader,
  wallet: string,
  sessionId: string
): TreasuryResponse {
  const snapshot = readSnapshot(store, wallet);

  if (snapshot.status !== "ready") {
    throw new Error("Create a sponsor treasury before bridging funds.");
  }

  const session = snapshot.sessions.find((item) => item.id === sessionId);

  if (!session) {
    throw new Error("Funding session not found.");
  }

  session.status = "completed";
  session.updatedAt = new Date().toISOString();
  snapshot.depositAddress = session.depositAddress;
  snapshot.lastSourceChain = session.sourceChain;
  snapshot.totalFundedUsdc = addUsdc(snapshot.totalFundedUsdc, session.amount);
  upsertBalance(snapshot, addUsdc(snapshot.availableArcUsdc, session.amount));

  prependEvent(
    snapshot,
    createEvent({
      kind: "bridge_completed",
      status: "success",
      title: "Arc treasury funded",
      detail: `${session.amount} USDC is now available on Arc Testnet and ready to top up your wallet for bounty creation.`
    })
  );
  prependEvent(
    snapshot,
    createEvent({
      kind: "bridge_started",
      status: "info",
      title: "Bridge simulated",
      detail: `The ${session.sourceChain} funding lane has been routed into Arc for session ${session.id.slice(0, 8)}.`
    })
  );
  prependEvent(
    snapshot,
    createEvent({
      kind: "deposit_received",
      status: "success",
      title: "Deposit received",
      detail: `${session.amount} USDC arrived from ${session.sourceChain} and entered the treasury bridge flow.`
    })
  );

  return { snapshot };
}

export function withdrawToWallet(
  store: CookieReader,
  wallet: string,
  amount: string
): TreasuryResponse {
  const snapshot = readSnapshot(store, wallet);

  if (snapshot.status !== "ready") {
    throw new Error("Create a sponsor treasury before withdrawing funds.");
  }

  parseUsdcAmount(amount);
  const nextBalance = subtractUsdc(snapshot.availableArcUsdc, amount);
  snapshot.totalWithdrawnUsdc = addUsdc(snapshot.totalWithdrawnUsdc, amount);
  upsertBalance(snapshot, nextBalance);

  prependEvent(
    snapshot,
    createEvent({
      kind: "withdrawal_completed",
      status: "success",
      title: "Wallet top-up ready",
      detail: `${amount} USDC has been earmarked for your connected Arc wallet so you can continue with the existing bounty flow.`
    })
  );

  return { snapshot };
}
