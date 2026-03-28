"use client";

import { useEffect, useState } from "react";
import { zeroAddress, type Hex } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract
} from "wagmi";

import { defaultCreateForm } from "@/components/bounty-board-config";
import type { BoardTab, BountyView, CreateForm } from "@/components/bounty-board-types";
import { erc20Abi, arcBountyBoardAbi } from "@/lib/abi";
import {
  readOwnedAgents,
  readReputationSummary,
  type BountyResult,
  type OwnedAgent,
  type ReputationSummary
} from "@/lib/agent-tools";
import { ARC_CONTRACTS, arcTestnet, bountyBoardAddress, hasBountyBoardAddress } from "@/lib/arc";
import { getErrorMessage, mapBounty, visibleBountyCount } from "@/hooks/bounty-board-shared";

export function useBountyBoardData() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });

  const [bounties, setBounties] = useState<BountyView[]>([]);
  const [ownedAgents, setOwnedAgents] = useState<OwnedAgent[]>([]);
  const [reputationByAgent, setReputationByAgent] = useState<Record<string, ReputationSummary>>({});
  const [isLoadingBounties, setIsLoadingBounties] = useState(false);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [agentLookupError, setAgentLookupError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<Hex | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [activeTab, setActiveTab] = useState<BoardTab>("board");
  const [createForm, setCreateForm] = useState<CreateForm>({ ...defaultCreateForm });

  const resolvedBoardAddress = bountyBoardAddress ?? zeroAddress;
  const walletAddress = address ?? zeroAddress;
  const isOnArc = chainId === arcTestnet.id;

  const { data: nextBountyId, refetch: refetchNextBountyId } = useReadContract({
    address: resolvedBoardAddress,
    abi: arcBountyBoardAbi,
    functionName: "nextBountyId",
    chainId: arcTestnet.id,
    query: {
      enabled: hasBountyBoardAddress
    }
  });

  const { data: walletUsdc } = useReadContract({
    address: ARC_CONTRACTS.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress],
    chainId: arcTestnet.id,
    query: {
      enabled: isConnected
    }
  });

  useEffect(() => {
    if (!publicClient || !hasBountyBoardAddress || typeof nextBountyId !== "bigint") {
      setBounties([]);
      return;
    }

    let cancelled = false;

    async function loadBounties() {
      setIsLoadingBounties(true);

      try {
        const client = publicClient;
        const bountyCount = nextBountyId;

        if (!client) {
          if (!cancelled) {
            setBounties([]);
          }
          return;
        }

        if (typeof bountyCount !== "bigint") {
          if (!cancelled) {
            setBounties([]);
          }
          return;
        }

        if (bountyCount === 0n) {
          if (!cancelled) setBounties([]);
          return;
        }

        const ids: bigint[] = [];

        for (let current = bountyCount - 1n; ids.length < visibleBountyCount; current -= 1n) {
          ids.push(current);

          if (current === 0n) break;
        }

        const items = await Promise.all(
          ids.map(async (id) => {
            const raw = (await client.readContract({
              address: resolvedBoardAddress,
              abi: arcBountyBoardAbi,
              functionName: "getBounty",
              args: [id]
            })) as BountyResult;

            return mapBounty(id, raw);
          })
        );

        if (!cancelled) {
          setBounties(items);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBounties(false);
        }
      }
    }

    void loadBounties();

    return () => {
      cancelled = true;
    };
  }, [nextBountyId, publicClient, refreshTick, resolvedBoardAddress]);

  useEffect(() => {
    if (!publicClient || !address || !isOnArc) {
      setOwnedAgents([]);
      setAgentLookupError(null);
      return;
    }

    const client = publicClient;
    const ownerAddress = address;
    let cancelled = false;

    async function loadOwnedAgentList() {
      setIsLoadingAgents(true);
      setAgentLookupError(null);

      try {
        const agents = await readOwnedAgents(client, ownerAddress);

        if (!cancelled) {
          setOwnedAgents(agents);
        }
      } catch (loadError) {
        if (!cancelled) {
          setAgentLookupError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAgents(false);
        }
      }
    }

    void loadOwnedAgentList();

    return () => {
      cancelled = true;
    };
  }, [address, isOnArc, publicClient, refreshTick]);

  useEffect(() => {
    if (!publicClient || !isOnArc) {
      setReputationByAgent({});
      return;
    }

    const uniqueAgentIds = [
      ...new Set(
        [
          ...ownedAgents.map((agent) => agent.agentId.toString()),
          ...bounties.filter((bounty) => bounty.agentId > 0n).map((bounty) => bounty.agentId.toString())
        ].filter(Boolean)
      )
    ];

    if (uniqueAgentIds.length === 0) {
      setReputationByAgent({});
      return;
    }

    const client = publicClient;
    let cancelled = false;

    async function loadReputationSummaries() {
      const settled = await Promise.allSettled(
        uniqueAgentIds.map(async (agentIdString) => {
          const summary = await readReputationSummary(client, BigInt(agentIdString));
          return [agentIdString, summary] as const;
        })
      );

      const entries = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

      if (!cancelled) {
        setReputationByAgent(Object.fromEntries(entries));
      }

      if (!cancelled && entries.length === 0) {
        const rejected = settled.find((result) => result.status === "rejected");

        if (rejected?.status === "rejected") {
          setError(getErrorMessage(rejected.reason));
        }
      }
    }

    void loadReputationSummaries();

    return () => {
      cancelled = true;
    };
  }, [bounties, isOnArc, ownedAgents, publicClient, refreshTick]);

  async function refreshBoard() {
    await refetchNextBountyId();
    setRefreshTick((value) => value + 1);
  }

  function resetCreateForm() {
    setCreateForm({ ...defaultCreateForm });
  }

  return {
    wallet: {
      address,
      chainId,
      isConnected,
      isOnArc,
      connectors,
      isConnecting,
      isSwitching,
      isWriting,
      connect,
      disconnect,
      switchChainAsync,
      writeContractAsync,
      publicClient,
      walletUsdc
    },
    board: {
      bounties,
      ownedAgents,
      reputationByAgent
    },
    ui: {
      isLoadingBounties,
      isLoadingAgents,
      agentLookupError,
      notice,
      error,
      lastHash,
      activeTab
    },
    meta: {
      hasBountyBoardAddress,
      bountyBoardAddress,
      resolvedBoardAddress,
      nextBountyId
    },
    forms: {
      createForm,
      setCreateForm
    },
    setters: {
      setNotice,
      setError,
      setLastHash,
      setActiveTab,
      setReputationByAgent
    },
    actions: {
      refreshBoard,
      resetCreateForm
    }
  };
}
