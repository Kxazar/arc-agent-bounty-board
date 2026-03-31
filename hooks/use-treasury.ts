"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";

import type { TreasuryResponse, TreasurySnapshot, TreasurySourceChain } from "@/lib/treasury-types";

const defaultSourceChain: TreasurySourceChain = "Base Sepolia";

function emptySnapshot(wallet: Address | undefined): TreasurySnapshot | null {
  if (!wallet) {
    return null;
  }

  return {
    mode: "demo",
    persistenceBackend: "cookie",
    ownerWallet: wallet,
    status: "not_created",
    circleWalletLabel: null,
    arcWalletAddress: null,
    availableArcUsdc: "0",
    totalFundedUsdc: "0",
    totalWithdrawnUsdc: "0",
    depositAddress: null,
    lastSourceChain: null,
    balances: [
      {
        chainKey: "arc",
        chainLabel: "Arc Testnet",
        asset: "USDC",
        amount: "0"
      }
    ],
    events: [],
    sessions: []
  };
}

async function parseResponse(response: Response) {
  const payload = (await response.json()) as TreasuryResponse & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Treasury request failed.");
  }

  return payload;
}

export function useTreasury(params: {
  address: Address | undefined;
  isConnected: boolean;
}) {
  const { address, isConnected } = params;
  const [snapshot, setSnapshot] = useState<TreasurySnapshot | null>(emptySnapshot(address));
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("12.5");
  const [withdrawAmount, setWithdrawAmount] = useState("2.5");
  const [sourceChain, setSourceChain] = useState<TreasurySourceChain>(defaultSourceChain);

  async function refreshTreasury() {
    if (!address || !isConnected) {
      setSnapshot(emptySnapshot(address));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/treasury?wallet=${address}`, {
        method: "GET",
        cache: "no-store"
      });
      const payload = await parseResponse(response);
      setSnapshot(payload.snapshot);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to load treasury.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshTreasury();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isConnected]);

  async function runMutation(input: {
    path: string;
    body: Record<string, string>;
    getSuccessMessage?: (snapshot: TreasurySnapshot) => string;
  }) {
    if (!address) {
      throw new Error("Connect a wallet first.");
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(input.path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          wallet: address,
          ...input.body
        })
      });
      const payload = await parseResponse(response);
      setSnapshot(payload.snapshot);
      setNotice(input.getSuccessMessage?.(payload.snapshot) ?? "Treasury updated.");
      return payload.snapshot;
    } catch (mutationError) {
      const nextError = mutationError instanceof Error ? mutationError.message : "Treasury action failed.";
      setError(nextError);
      throw mutationError;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createTreasury() {
    return runMutation({
      path: "/api/treasury/create",
      body: {},
      getSuccessMessage: (snapshot) =>
        snapshot.mode === "live" ? "Live treasury created through Circle DCW." : "Treasury created."
    });
  }

  async function issueDepositAddress() {
    return runMutation(
      {
        path: "/api/treasury/deposit-address",
        body: {
          sourceChain,
          amount: depositAmount
        },
        getSuccessMessage: (snapshot) =>
          snapshot.mode === "live" ? "Live deposit lane issued." : "Deposit address issued."
      }
    );
  }

  async function simulateBridge(sessionId: string) {
    return runMutation(
      {
        path: "/api/treasury/bridge",
        body: {
          sessionId
        },
        getSuccessMessage: (snapshot) =>
          snapshot.mode === "live" ? "Bridge request processed for the live treasury." : "Treasury bridge simulated."
      }
    );
  }

  async function withdrawToWallet() {
    return runMutation(
      {
        path: "/api/treasury/withdraw-to-wallet",
        body: {
          amount: withdrawAmount
        },
        getSuccessMessage: (snapshot) =>
          snapshot.mode === "live"
            ? "Treasury transfer submitted to your connected wallet."
            : "Arc treasury balance marked for wallet top-up."
      }
    );
  }

  const latestSession = useMemo(() => snapshot?.sessions[0] ?? null, [snapshot]);

  return {
    snapshot,
    latestSession,
    isLoading,
    isSubmitting,
    error,
    notice,
    sourceChain,
    setSourceChain,
    depositAmount,
    setDepositAmount,
    withdrawAmount,
    setWithdrawAmount,
    refreshTreasury,
    createTreasury,
    issueDepositAddress,
    simulateBridge,
    withdrawToWallet
  };
}
