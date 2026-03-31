import { createHash } from "node:crypto";

import type { TreasuryResponse, TreasurySnapshot, TreasurySourceChain } from "@/lib/treasury-types";
import {
  type CookieReader,
  type CookieWriter,
  MAX_EVENTS,
  MAX_SESSIONS,
  addUsdc,
  assertWallet,
  buildArcBalance,
  clampRecent,
  createEmptySnapshot,
  createEvent,
  normalizeWallet,
  parseUsdcAmount,
  subtractUsdc
} from "@/lib/treasury-shared";

const COOKIE_PREFIX = "arc_treasury_demo_v1_";

function cookieNameForWallet(wallet: string) {
  return `${COOKIE_PREFIX}${normalizeWallet(wallet)}`;
}

function makePseudoAddress(seed: string) {
  return `0x${createHash("sha256").update(seed).digest("hex").slice(0, 40)}`;
}

function parseSnapshot(raw: string | undefined, wallet: string) {
  if (!raw) {
    return createEmptySnapshot({
      mode: "demo",
      ownerWallet: wallet,
      persistenceBackend: "cookie"
    });
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TreasurySnapshot> & { ownerWallet?: string };

    if (!parsed.ownerWallet || normalizeWallet(parsed.ownerWallet) !== normalizeWallet(wallet)) {
      return createEmptySnapshot({
        mode: "demo",
        ownerWallet: wallet,
        persistenceBackend: "cookie"
      });
    }

    return {
      ...parsed,
      mode: "demo" as const,
      persistenceBackend: "cookie" as const,
      balances: parsed.balances?.length ? parsed.balances : [buildArcBalance(parsed.availableArcUsdc ?? "0")],
      events: parsed.events ?? [],
      sessions: parsed.sessions ?? []
    } as TreasurySnapshot;
  } catch {
    return createEmptySnapshot({
      mode: "demo",
      ownerWallet: wallet,
      persistenceBackend: "cookie"
    });
  }
}

function readSnapshot(store: CookieReader, wallet: string) {
  assertWallet(wallet);
  return parseSnapshot(store.get(cookieNameForWallet(wallet))?.value, wallet);
}

export function persistDemoTreasurySnapshot(store: CookieWriter, snapshot: TreasurySnapshot) {
  store.set(cookieNameForWallet(snapshot.ownerWallet), JSON.stringify(snapshot), {
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

function prependEvent(snapshot: TreasurySnapshot, event: TreasurySnapshot["events"][number]) {
  snapshot.events = clampRecent([event, ...snapshot.events], MAX_EVENTS);
}

function upsertBalance(snapshot: TreasurySnapshot, amount: string) {
  snapshot.availableArcUsdc = amount;
  snapshot.balances = [buildArcBalance(amount, snapshot.arcWalletAddress)];
}

function createSession(sourceChain: TreasurySourceChain, amount: string, ownerWallet: string) {
  const id = crypto.randomUUID();

  return {
    id,
    sourceChain,
    targetChain: "Arc Testnet" as const,
    amount,
    status: "address_issued" as const,
    depositAddress: makePseudoAddress(`${ownerWallet}:${sourceChain}:${id}`),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function getDemoTreasurySnapshot(store: CookieReader, wallet: string): Promise<TreasuryResponse> {
  return { snapshot: readSnapshot(store, wallet) };
}

export async function createDemoTreasury(store: CookieReader, wallet: string): Promise<TreasuryResponse> {
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

export async function issueDemoDepositAddress(
  store: CookieReader,
  wallet: string,
  sourceChain: TreasurySourceChain,
  amount: string
): Promise<TreasuryResponse> {
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

export async function simulateDemoBridge(
  store: CookieReader,
  wallet: string,
  sessionId: string
): Promise<TreasuryResponse> {
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

export async function withdrawDemoToWallet(
  store: CookieReader,
  wallet: string,
  amount: string
): Promise<TreasuryResponse> {
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
