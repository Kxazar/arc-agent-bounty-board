import type { TreasuryResponse, TreasurySnapshot, TreasurySourceChain } from "@/lib/treasury-types";
import {
  type CookieReader,
  type CookieWriter,
  assertWallet
} from "@/lib/treasury-shared";
import {
  createDemoTreasury,
  getDemoTreasurySnapshot,
  issueDemoDepositAddress,
  persistDemoTreasurySnapshot,
  simulateDemoBridge,
  withdrawDemoToWallet
} from "@/lib/treasury-demo-service";
import { getTreasuryEnvironment } from "@/lib/treasury-env";
import {
  createLiveTreasury,
  getLiveTreasurySnapshot,
  issueLiveDepositAddress,
  simulateLiveBridge,
  withdrawLiveToWallet
} from "@/lib/treasury-live-service";

function isTreasuryLiveModeEnabled() {
  return getTreasuryEnvironment().isLiveModeEnabled;
}

export async function getTreasurySnapshot(store: CookieReader, wallet: string): Promise<TreasuryResponse> {
  assertWallet(wallet);

  if (isTreasuryLiveModeEnabled()) {
    return getLiveTreasurySnapshot(wallet);
  }

  return getDemoTreasurySnapshot(store, wallet);
}

export async function createTreasury(store: CookieReader, wallet: string): Promise<TreasuryResponse> {
  assertWallet(wallet);

  if (isTreasuryLiveModeEnabled()) {
    return createLiveTreasury(wallet);
  }

  return createDemoTreasury(store, wallet);
}

export async function issueDepositAddress(
  store: CookieReader,
  wallet: string,
  sourceChain: TreasurySourceChain,
  amount: string
): Promise<TreasuryResponse> {
  assertWallet(wallet);

  if (isTreasuryLiveModeEnabled()) {
    return issueLiveDepositAddress(wallet, sourceChain, amount);
  }

  return issueDemoDepositAddress(store, wallet, sourceChain, amount);
}

export async function simulateBridge(
  store: CookieReader,
  wallet: string,
  sessionId: string
): Promise<TreasuryResponse> {
  assertWallet(wallet);

  if (isTreasuryLiveModeEnabled()) {
    return simulateLiveBridge(wallet, sessionId);
  }

  return simulateDemoBridge(store, wallet, sessionId);
}

export async function withdrawToWallet(
  store: CookieReader,
  wallet: string,
  amount: string
): Promise<TreasuryResponse> {
  assertWallet(wallet);

  if (isTreasuryLiveModeEnabled()) {
    return withdrawLiveToWallet(wallet, amount);
  }

  return withdrawDemoToWallet(store, wallet, amount);
}

export function persistTreasurySnapshot(store: CookieWriter, snapshot: TreasurySnapshot) {
  if (snapshot.mode === "demo") {
    persistDemoTreasurySnapshot(store, snapshot);
  }
}
