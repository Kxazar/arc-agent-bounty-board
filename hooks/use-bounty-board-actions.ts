"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { formatUnits, maxUint256, parseUnits, type Address, type Hex, type PublicClient } from "viem";

import { defaultCreateForm } from "@/components/bounty-board-config";
import type { BoardTab, BountyView, CreateForm, ReputationDraft, ReviewDraft } from "@/components/bounty-board-types";
import { arcBountyBoardAbi, erc20Abi, identityRegistryAbi } from "@/lib/abi";
import { buildBountyNoteUri, buildMetadataUri, readReputationSummary, type ReputationSummary } from "@/lib/agent-tools";
import { ARC_CONTRACTS, arcTestnet } from "@/lib/arc";
import {
  defaultReviewDraft,
  defaultReputationDraft,
  getErrorMessage,
  parseNumericId,
  parsePositiveWholeNumber,
  type BoardActionName,
  type ClaimForm,
  type ResultForm
} from "@/hooks/bounty-board-shared";

const claimWindowSecondsByUnit = {
  hours: 3_600,
  days: 86_400,
  weeks: 604_800,
  months: 2_592_000
} as const;

type WriteContractFn = (parameters: {
  address: Address;
  abi: unknown;
  functionName: string;
  args: readonly unknown[];
  chainId: number;
}) => Promise<Hex>;

type UseBountyBoardActionsParams = {
  address: Address | undefined;
  publicClient: PublicClient | undefined;
  writeContractAsync: WriteContractFn;
  ensureArcWallet: () => Promise<void>;
  waitForReceipt: (hash: Hex) => Promise<void>;
  refreshBoard: () => Promise<void>;
  setNotice: (value: string | null) => void;
  setError: (value: string | null) => void;
  setActiveTab: Dispatch<SetStateAction<BoardTab>>;
  setReputationByAgent: Dispatch<SetStateAction<Record<string, ReputationSummary>>>;
  createForm: CreateForm;
  setCreateForm: Dispatch<SetStateAction<CreateForm>>;
  ownedAgents: Array<{ agentId: bigint }>;
  bounties: BountyView[];
  hasBountyBoardAddress: boolean;
  resolvedBoardAddress: Address;
  nextBountyId: bigint | undefined;
};

export function useBountyBoardActions({
  address,
  publicClient,
  writeContractAsync,
  ensureArcWallet,
  waitForReceipt,
  refreshBoard,
  setNotice,
  setError,
  setActiveTab,
  setReputationByAgent,
  createForm,
  setCreateForm,
  ownedAgents,
  bounties,
  hasBountyBoardAddress,
  resolvedBoardAddress,
  nextBountyId
}: UseBountyBoardActionsParams) {
  const [claimForm, setClaimForm] = useState<ClaimForm>({
    bountyId: "0",
    agentId: ""
  });
  const [resultForm, setResultForm] = useState<ResultForm>({
    bountyId: "0",
    resultURI: "https://example.com/results/support-summary"
  });
  const [reputationDrafts, setReputationDrafts] = useState<Record<string, ReputationDraft>>({});
  const [reputationReceipts, setReputationReceipts] = useState<Record<string, string>>({});
  const [activeReputationBountyId, setActiveReputationBountyId] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [activeReviewBountyId, setActiveReviewBountyId] = useState<string | null>(null);
  const [editingBountyId, setEditingBountyId] = useState<string | null>(null);
  const [isPostingReputationFor, setIsPostingReputationFor] = useState<string | null>(null);

  function resetCreateStudio() {
    setEditingBountyId(null);
    setCreateForm({ ...defaultCreateForm });
  }

  function deriveClaimHours(deadline: bigint) {
    const remainingSeconds = Number(deadline) - Math.floor(Date.now() / 1000);
    return Math.max(1, Math.ceil(remainingSeconds / 3600)).toString();
  }

  function deriveClaimWindowInput(deadline: bigint): Pick<CreateForm, "claimWindowValue" | "claimWindowUnit"> {
    const remainingSeconds = Math.max(3_600, Number(deadline) - Math.floor(Date.now() / 1000));

    if (remainingSeconds % claimWindowSecondsByUnit.months === 0) {
      return {
        claimWindowValue: Math.max(1, Math.ceil(remainingSeconds / claimWindowSecondsByUnit.months)).toString(),
        claimWindowUnit: "months"
      };
    }

    if (remainingSeconds % claimWindowSecondsByUnit.weeks === 0) {
      return {
        claimWindowValue: Math.max(1, Math.ceil(remainingSeconds / claimWindowSecondsByUnit.weeks)).toString(),
        claimWindowUnit: "weeks"
      };
    }

    if (remainingSeconds % claimWindowSecondsByUnit.days === 0) {
      return {
        claimWindowValue: Math.max(1, Math.ceil(remainingSeconds / claimWindowSecondsByUnit.days)).toString(),
        claimWindowUnit: "days"
      };
    }

    return {
      claimWindowValue: deriveClaimHours(deadline),
      claimWindowUnit: "hours"
    };
  }

  function resolveClaimWindowSeconds() {
    const claimWindowValue = parsePositiveWholeNumber(createForm.claimWindowValue, "Claim window");
    const multiplier = claimWindowSecondsByUnit[createForm.claimWindowUnit];
    const totalSeconds = claimWindowValue * multiplier;

    if (totalSeconds > 4_294_967_295) {
      throw new Error("Claim window is too large for the current contract.");
    }

    return totalSeconds;
  }

  function handleSelectAgent(agentId: bigint) {
    setClaimForm((current) => ({
      ...current,
      agentId: agentId.toString()
    }));
  }

  function primeClaimFlow(bountyId: bigint) {
    setClaimForm((current) => ({
      ...current,
      bountyId: bountyId.toString(),
      agentId: current.agentId || ownedAgents[0]?.agentId.toString() || ""
    }));
    document.getElementById("claim-studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function primeResultFlow(bountyId: bigint) {
    setResultForm((current) => ({
      ...current,
      bountyId: bountyId.toString()
    }));
    document.getElementById("delivery-studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function primeEditFlow(bounty: BountyView) {
    setActiveTab("board");
    setEditingBountyId(bounty.id.toString());
    const claimWindowInput = deriveClaimWindowInput(bounty.claimDeadline);

    setCreateForm({
      title: bounty.title,
      summary: bounty.summary,
      contact: bounty.contact,
      reward: formatUnits(bounty.payoutAmount, 6),
      claimWindowValue: claimWindowInput.claimWindowValue,
      claimWindowUnit: claimWindowInput.claimWindowUnit,
      submissionHours: Math.max(1, Math.ceil(bounty.submissionWindow / 3600)).toString(),
      reviewHours: Math.max(1, Math.ceil(bounty.reviewWindow / 3600)).toString()
    });
    document.getElementById("create-studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openReputationComposer(bounty: BountyView) {
    const key = bounty.id.toString();

    setActiveReputationBountyId(key);
    setReputationDrafts((current) => ({
      ...current,
      [key]: current[key] ?? defaultReputationDraft(bounty.title)
    }));
  }

  function openReviewComposer(bounty: BountyView) {
    const key = bounty.id.toString();

    setActiveReviewBountyId(key);
    setReviewDrafts((current) => ({
      ...current,
      [key]: current[key] ?? defaultReviewDraft(bounty.title)
    }));
  }

  function updateReputationDraft(
    bountyId: string,
    bountyTitle: string,
    updater: (draft: ReputationDraft) => ReputationDraft
  ) {
    setReputationDrafts((current) => ({
      ...current,
      [bountyId]: updater(current[bountyId] ?? defaultReputationDraft(bountyTitle))
    }));
  }

  function updateReviewDraft(
    bountyId: string,
    bountyTitle: string,
    updater: (draft: ReviewDraft) => ReviewDraft
  ) {
    setReviewDrafts((current) => ({
      ...current,
      [bountyId]: updater(current[bountyId] ?? defaultReviewDraft(bountyTitle))
    }));
  }

  async function handleCreateBounty() {
    if (!publicClient || !hasBountyBoardAddress) {
      setError("Set NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS before creating bounties.");
      return;
    }

    try {
      await ensureArcWallet();
      setError(null);
      const connectedAddress = address;
      const title = createForm.title.trim();
      const summary = createForm.summary.trim();
      const contact = createForm.contact.trim();

      if (!connectedAddress) {
        throw new Error("Connect your wallet first.");
      }

      if (!title) throw new Error("Title is required.");
      if (!summary) throw new Error("Summary is required.");
      if (!contact) throw new Error("Creator contact is required.");

      const payoutAmount = parseUnits(createForm.reward.trim() || "0", 6);
      const claimWindow = resolveClaimWindowSeconds();
      const submissionWindow =
        parsePositiveWholeNumber(createForm.submissionHours, "Submission window") * 3600;
      const reviewWindow = parsePositiveWholeNumber(createForm.reviewHours, "Review window") * 3600;
      const editingBounty = bounties.find((bounty) => bounty.id.toString() === editingBountyId) ?? null;
      const createdBountyId = typeof nextBountyId === "bigint" ? nextBountyId : null;
      const additionalEscrowNeeded =
        editingBounty && payoutAmount > editingBounty.payoutAmount
          ? payoutAmount - editingBounty.payoutAmount
          : editingBounty
            ? 0n
            : payoutAmount;

      if (payoutAmount <= 0n) {
        throw new Error("Reward amount must be greater than zero.");
      }

      const allowance = (await publicClient.readContract({
        address: ARC_CONTRACTS.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [connectedAddress, resolvedBoardAddress]
      })) as bigint;

      if (additionalEscrowNeeded > 0n && allowance < additionalEscrowNeeded) {
        setNotice("Approving USDC escrow allowance...");

        const approveHash = await writeContractAsync({
          address: ARC_CONTRACTS.usdc,
          abi: erc20Abi,
          functionName: "approve",
          args: [resolvedBoardAddress, maxUint256],
          chainId: arcTestnet.id
        });

        await waitForReceipt(approveHash);
      }

      const metadataURI = buildMetadataUri({
        title,
        summary,
        contact
      });

      if (editingBounty) {
        setNotice("Updating bounty on Arc Testnet...");

        const updateHash = await writeContractAsync({
          address: resolvedBoardAddress,
          abi: arcBountyBoardAbi,
          functionName: "updateBounty",
          args: [
            editingBounty.id,
            metadataURI,
            payoutAmount,
            claimWindow,
            submissionWindow,
            reviewWindow
          ],
          chainId: arcTestnet.id
        });

        await waitForReceipt(updateHash);
        await refreshBoard();
        resetCreateStudio();
        setNotice("Bounty updated. Your sponsor workspace now reflects the latest details.");
        return;
      }

      setNotice("Creating bounty on Arc Testnet...");

      const createHash = await writeContractAsync({
        address: resolvedBoardAddress,
        abi: arcBountyBoardAbi,
        functionName: "createBounty",
        args: [metadataURI, payoutAmount, claimWindow, submissionWindow, reviewWindow],
        chainId: arcTestnet.id
      });

      await waitForReceipt(createHash);
      await refreshBoard();
      if (createdBountyId !== null) {
        primeClaimFlow(createdBountyId);
      }
      setNotice("Bounty created. Share the explorer link in Discord.");
    } catch (createError) {
      setError(getErrorMessage(createError));
    }
  }

  async function claimSpecificBounty(rawBountyId: string, rawAgentId: string) {
    if (!publicClient || !hasBountyBoardAddress) {
      setError("Deploy the board contract and expose NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS first.");
      return;
    }

    try {
      await ensureArcWallet();
      setError(null);
      setNotice("Validating agent ownership in Arc IdentityRegistry...");
      const connectedAddress = address;

      if (!connectedAddress) {
        throw new Error("Connect your wallet first.");
      }

      const agentId = parseNumericId(rawAgentId, "Agent ID");
      const bountyId = parseNumericId(rawBountyId, "Bounty ID");
      const owner = (await publicClient.readContract({
        address: ARC_CONTRACTS.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "ownerOf",
        args: [agentId]
      })) as Address;

      if (owner.toLowerCase() !== connectedAddress.toLowerCase()) {
        throw new Error("The connected wallet does not own this Arc agent.");
      }

      setNotice("Claiming bounty with your Arc agent identity...");

      const hash = await writeContractAsync({
        address: resolvedBoardAddress,
        abi: arcBountyBoardAbi,
        functionName: "claimBounty",
        args: [bountyId, agentId],
        chainId: arcTestnet.id
      });

      await waitForReceipt(hash);
      await refreshBoard();
      primeResultFlow(bountyId);
      setNotice("Bounty claimed. Move to the delivery panel and submit the result URI.");
    } catch (claimError) {
      setError(getErrorMessage(claimError));
    }
  }

  async function handleClaimBounty() {
    await claimSpecificBounty(claimForm.bountyId, claimForm.agentId);
  }

  async function handleSubmitResult() {
    if (!hasBountyBoardAddress) {
      setError("Deploy the board contract and expose NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS first.");
      return;
    }

    try {
      await ensureArcWallet();
      setError(null);
      setNotice("Submitting result URI to escrow...");
      const bountyId = parseNumericId(resultForm.bountyId, "Bounty ID");
      const resultURI = resultForm.resultURI.trim();

      if (!resultURI) {
        throw new Error("Result URI is required.");
      }

      const hash = await writeContractAsync({
        address: resolvedBoardAddress,
        abi: arcBountyBoardAbi,
        functionName: "submitResult",
        args: [bountyId, resultURI],
        chainId: arcTestnet.id
      });

      await waitForReceipt(hash);
      await refreshBoard();
      setNotice("Result submitted. The sponsor review gate is now active.");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  function buildReviewNoteUri(bounty: BountyView, kind: "review_passed" | "changes_requested" | "dispute_opened") {
    const bountyKey = bounty.id.toString();
    const note = (reviewDrafts[bountyKey] ?? defaultReviewDraft(bounty.title)).note.trim();

    const fallbackNote =
      kind === "review_passed"
        ? `Review passed for "${bounty.title}". Releasing the escrowed payout.`
        : kind === "changes_requested"
          ? `Changes requested for "${bounty.title}". Please revise and resubmit.`
          : `Dispute opened for "${bounty.title}". Waiting for decentralized resolution.`;

    return buildBountyNoteUri({
      kind,
      note: note || fallbackNote
    });
  }

  async function runBoardAction(functionName: BoardActionName, bounty: BountyView, label: string) {
    if (!hasBountyBoardAddress) {
      setError("Deploy the board contract and expose NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS first.");
      return;
    }

    try {
      await ensureArcWallet();
      setError(null);
      setNotice(label);

      const hash = await writeContractAsync({
        address: resolvedBoardAddress,
        abi: arcBountyBoardAbi,
        functionName,
        args: [bounty.id],
        chainId: arcTestnet.id
      });

      await waitForReceipt(hash);
      await refreshBoard();

      if ((functionName === "approveBounty" || functionName === "releaseAfterReviewTimeout") && bounty.agentId > 0n) {
        openReputationComposer(bounty);
        setNotice("Payout approved. Finish the flow with an onchain reputation note.");
      } else {
        setNotice("Action confirmed on Arc.");
      }
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    }
  }

  async function approveBounty(bounty: BountyView) {
    if (!hasBountyBoardAddress) {
      setError("Deploy the board contract and expose NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS first.");
      return;
    }

    try {
      await ensureArcWallet();
      setError(null);
      setNotice("Passing sponsor review and releasing payout...");

      const hash = await writeContractAsync({
        address: resolvedBoardAddress,
        abi: arcBountyBoardAbi,
        functionName: "approveBounty",
        args: [bounty.id, buildReviewNoteUri(bounty, "review_passed")],
        chainId: arcTestnet.id
      });

      await waitForReceipt(hash);
      await refreshBoard();
      setActiveReviewBountyId(null);

      if (bounty.agentId > 0n) {
        openReputationComposer(bounty);
      }

      setNotice("Review passed and payout released. Finish the flow with an onchain reputation note.");
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    }
  }

  async function requestChanges(bounty: BountyView) {
    if (!hasBountyBoardAddress) {
      setError("Deploy the board contract and expose NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS first.");
      return;
    }

    try {
      await ensureArcWallet();
      setError(null);
      setNotice("Requesting a revision from the claimant...");

      const hash = await writeContractAsync({
        address: resolvedBoardAddress,
        abi: arcBountyBoardAbi,
        functionName: "requestChanges",
        args: [bounty.id, buildReviewNoteUri(bounty, "changes_requested")],
        chainId: arcTestnet.id
      });

      await waitForReceipt(hash);
      await refreshBoard();
      setActiveReviewBountyId(null);
      setNotice("Revision requested. The claimant can now resubmit or escalate into dispute.");
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    }
  }

  async function openDispute(bounty: BountyView) {
    if (!hasBountyBoardAddress) {
      setError("Deploy the board contract and expose NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS first.");
      return;
    }

    try {
      await ensureArcWallet();
      setError(null);
      setNotice("Opening a dispute and freezing the escrow...");

      const hash = await writeContractAsync({
        address: resolvedBoardAddress,
        abi: arcBountyBoardAbi,
        functionName: "openDispute",
        args: [bounty.id, buildReviewNoteUri(bounty, "dispute_opened")],
        chainId: arcTestnet.id
      });

      await waitForReceipt(hash);
      await refreshBoard();
      setActiveReviewBountyId(null);
      setNotice("Dispute opened. Escrow stays locked until decentralized resolution is introduced.");
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    }
  }

  async function handlePostReputation(bounty: BountyView) {
    const bountyKey = bounty.id.toString();
    const draft = reputationDrafts[bountyKey] ?? defaultReputationDraft(bounty.title);

    try {
      setIsPostingReputationFor(bountyKey);
      setError(null);
      setNotice("Recording reputation to Arc...");

      const response = await fetch("/api/reputation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bountyId: bountyKey,
          score: Number(draft.score),
          tag1: draft.tag1,
          tag2: draft.tag2,
          note: draft.note
        })
      });

      const payload = (await response.json()) as { error?: string; explorerUrl?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to record reputation.");
      }

      setReputationReceipts((current) => ({
        ...current,
        [bountyKey]: payload.explorerUrl ?? ""
      }));

      if (publicClient && bounty.agentId > 0n) {
        const summary = await readReputationSummary(publicClient, bounty.agentId);
        setReputationByAgent((current) => ({
          ...current,
          [bounty.agentId.toString()]: summary
        }));
      }

      setNotice("Reputation recorded on Arc.");
    } catch (postError) {
      setError(getErrorMessage(postError));
    } finally {
      setIsPostingReputationFor(null);
    }
  }

  async function cancelUnclaimedBounty(bounty: BountyView) {
    await runBoardAction("cancelUnclaimedBounty", bounty, "Cancelling expired bounty...");
  }

  async function reclaimExpiredClaim(bounty: BountyView) {
    await runBoardAction("reclaimExpiredClaim", bounty, "Recovering missed claim...");
  }

  async function releaseAfterReviewTimeout(bounty: BountyView) {
    await runBoardAction("releaseAfterReviewTimeout", bounty, "Releasing after review timeout...");
  }

  return {
    state: {
      claimForm,
      setClaimForm,
      resultForm,
      setResultForm,
      reputationDrafts,
      reputationReceipts,
      activeReputationBountyId,
      reviewDrafts,
      activeReviewBountyId,
      editingBountyId,
      isPostingReputationFor
    },
    actions: {
      resetCreateStudio,
      handleSelectAgent,
      primeClaimFlow,
      primeResultFlow,
      primeEditFlow,
      openReputationComposer,
      openReviewComposer,
      updateReputationDraft,
      updateReviewDraft,
      handleCreateBounty,
      claimSpecificBounty,
      handleClaimBounty,
      handleSubmitResult,
      handlePostReputation,
      approveBounty,
      requestChanges,
      openDispute,
      cancelUnclaimedBounty,
      reclaimExpiredClaim,
      releaseAfterReviewTimeout
    }
  };
}
