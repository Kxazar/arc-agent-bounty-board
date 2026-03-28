"use client";

import type { Hex } from "viem";

import { arcTestnet } from "@/lib/arc";
import { defaultDiscussionDraft } from "@/hooks/bounty-board-shared";
import { useBountyBoardActions } from "@/hooks/use-bounty-board-actions";
import { useBountyBoardData } from "@/hooks/use-bounty-board-data";
import { useDiscussionComposer } from "@/hooks/use-discussion-composer";

export function useBountyBoard() {
  const data = useBountyBoardData();
  const { wallet: walletData, board: boardData, ui: uiData, meta, forms, setters, actions: dataActions } = data;
  const writeContractAsync = walletData.writeContractAsync as unknown as (parameters: {
    address: `0x${string}`;
    abi: unknown;
    functionName: string;
    args: readonly unknown[];
    chainId: number;
  }) => Promise<Hex>;

  async function ensureArcWallet() {
    if (!walletData.address) {
      throw new Error("Connect your wallet first.");
    }

    if (walletData.chainId === arcTestnet.id) return;
    if (!walletData.switchChainAsync) {
      throw new Error("Your wallet cannot switch networks automatically. Move to Arc Testnet manually.");
    }

    await walletData.switchChainAsync({ chainId: arcTestnet.id });
  }

  async function waitForReceipt(hash: Hex) {
    if (!walletData.publicClient) {
      throw new Error("Arc public client is not ready yet.");
    }

    await walletData.publicClient.waitForTransactionReceipt({ hash });
    setters.setLastHash(hash);
  }

  const discussion = useDiscussionComposer({
    publicClient: walletData.publicClient,
    resolvedBoardAddress: meta.resolvedBoardAddress,
    hasBountyBoardAddress: meta.hasBountyBoardAddress,
    ensureArcWallet,
    waitForReceipt,
    writeContractAsync,
    setNotice: setters.setNotice,
    setError: setters.setError,
    chainId: arcTestnet.id
  });

  const boardActions = useBountyBoardActions({
    address: walletData.address,
    publicClient: walletData.publicClient,
    writeContractAsync,
    ensureArcWallet,
    waitForReceipt,
    refreshBoard: dataActions.refreshBoard,
    setNotice: setters.setNotice,
    setError: setters.setError,
    setActiveTab: setters.setActiveTab,
    setReputationByAgent: setters.setReputationByAgent,
    createForm: forms.createForm,
    setCreateForm: forms.setCreateForm,
    ownedAgents: boardData.ownedAgents,
    bounties: boardData.bounties,
    hasBountyBoardAddress: meta.hasBountyBoardAddress,
    resolvedBoardAddress: meta.resolvedBoardAddress,
    nextBountyId: typeof meta.nextBountyId === "bigint" ? meta.nextBountyId : undefined
  });

  const claimForm = boardActions.state.claimForm;
  const resultForm = boardActions.state.resultForm;
  const editingBountyId = boardActions.state.editingBountyId;
  const activeDiscussionBountyId = discussion.state.activeDiscussionBountyId;

  const selectedAgent =
    boardData.ownedAgents.find((agent) => agent.agentId.toString() === claimForm.agentId) ?? null;
  const selectedAgentReputation = selectedAgent
    ? boardData.reputationByAgent[selectedAgent.agentId.toString()]
    : undefined;
  const selectedBounty =
    boardData.bounties.find((bounty) => bounty.id.toString() === claimForm.bountyId) ?? null;
  const preparedResultBounty =
    boardData.bounties.find((bounty) => bounty.id.toString() === resultForm.bountyId) ?? null;
  const editingBounty =
    boardData.bounties.find((bounty) => bounty.id.toString() === editingBountyId) ?? null;
  const activeDiscussionBounty =
    activeDiscussionBountyId
      ? boardData.bounties.find((bounty) => bounty.id.toString() === activeDiscussionBountyId) ?? null
      : null;
  const activeDiscussionDraft = activeDiscussionBountyId
    ? discussion.state.messageDrafts[activeDiscussionBountyId] ?? defaultDiscussionDraft()
    : null;
  const activeDiscussionMessages = activeDiscussionBountyId
    ? discussion.state.messagesByBounty[activeDiscussionBountyId] ?? []
    : [];
  const connectedAddress = walletData.address;
  const myBounties =
    connectedAddress
      ? boardData.bounties.filter((bounty) => bounty.creator.toLowerCase() === connectedAddress.toLowerCase())
      : [];
  const activeAgentCount = new Set(
    boardData.bounties.filter((bounty) => bounty.agentId > 0n).map((bounty) => bounty.agentId.toString())
  ).size;

  function connectWallet() {
    if (walletData.connectors[0]) {
      walletData.connect({ connector: walletData.connectors[0] });
    }
  }

  async function switchToArc() {
    await walletData.switchChainAsync?.({ chainId: arcTestnet.id });
  }

  return {
    wallet: {
      address: walletData.address,
      chainId: walletData.chainId,
      isConnected: walletData.isConnected,
      isOnArc: walletData.isOnArc,
      connectors: walletData.connectors,
      isConnecting: walletData.isConnecting,
      isSwitching: walletData.isSwitching,
      connectWallet,
      disconnectWallet: walletData.disconnect,
      switchToArc,
      walletUsdc: walletData.walletUsdc
    },
    board: {
      bounties: boardData.bounties,
      myBounties,
      ownedAgents: boardData.ownedAgents,
      selectedAgent,
      selectedAgentReputation,
      selectedBounty,
      preparedResultBounty,
      editingBounty,
      activeDiscussionBounty,
      activeDiscussionDraft,
      activeDiscussionMessages,
      activeAgentCount,
      reputationByAgent: boardData.reputationByAgent,
      reputationDrafts: boardActions.state.reputationDrafts,
      reputationReceipts: boardActions.state.reputationReceipts
    },
    forms: {
      createForm: forms.createForm,
      setCreateForm: forms.setCreateForm,
      claimForm,
      setClaimForm: boardActions.state.setClaimForm,
      resultForm,
      setResultForm: boardActions.state.setResultForm
    },
    ui: {
      activeTab: uiData.activeTab,
      setActiveTab: setters.setActiveTab,
      notice: uiData.notice,
      error: uiData.error,
      lastHash: uiData.lastHash,
      isWriting: walletData.isWriting,
      isLoadingBounties: uiData.isLoadingBounties,
      isLoadingAgents: uiData.isLoadingAgents,
      isPostingReputationFor: boardActions.state.isPostingReputationFor,
      isLoadingMessagesFor: discussion.state.isLoadingMessagesFor,
      isPostingMessageFor: discussion.state.isPostingMessageFor,
      isFormatMenuOpen: discussion.state.isFormatMenuOpen,
      isAttachmentMenuOpen: discussion.state.isAttachmentMenuOpen,
      activeReputationBountyId: boardActions.state.activeReputationBountyId,
      activeDiscussionBountyId,
      agentLookupError: uiData.agentLookupError,
      discussionTextareaRef: discussion.state.discussionTextareaRef
    },
    meta: {
      hasBountyBoardAddress: meta.hasBountyBoardAddress,
      bountyBoardAddress: meta.bountyBoardAddress,
      resolvedBoardAddress: meta.resolvedBoardAddress
    },
    actions: {
      refreshBoard: dataActions.refreshBoard,
      resetCreateStudio: boardActions.actions.resetCreateStudio,
      handleSelectAgent: boardActions.actions.handleSelectAgent,
      primeClaimFlow: boardActions.actions.primeClaimFlow,
      primeResultFlow: boardActions.actions.primeResultFlow,
      primeEditFlow: boardActions.actions.primeEditFlow,
      openDiscussion: discussion.actions.openDiscussion,
      closeDiscussion: discussion.actions.closeDiscussion,
      updateDiscussionDraft: discussion.actions.updateDiscussionDraft,
      applyTextStyle: discussion.actions.applyTextStyle,
      handleAttachmentFileChange: discussion.actions.handleAttachmentFileChange,
      clearAttachment: discussion.actions.clearAttachment,
      handleCreateBounty: boardActions.actions.handleCreateBounty,
      claimSpecificBounty: boardActions.actions.claimSpecificBounty,
      handleClaimBounty: boardActions.actions.handleClaimBounty,
      handleSubmitResult: boardActions.actions.handleSubmitResult,
      approveBounty: boardActions.actions.approveBounty,
      cancelUnclaimedBounty: boardActions.actions.cancelUnclaimedBounty,
      reclaimExpiredClaim: boardActions.actions.reclaimExpiredClaim,
      releaseAfterReviewTimeout: boardActions.actions.releaseAfterReviewTimeout,
      openReputationComposer: boardActions.actions.openReputationComposer,
      updateReputationDraft: boardActions.actions.updateReputationDraft,
      handlePostReputation: boardActions.actions.handlePostReputation,
      handlePostMessage: discussion.actions.handlePostMessage,
      toggleFormatMenu: discussion.actions.toggleFormatMenu,
      toggleAttachmentMenu: discussion.actions.toggleAttachmentMenu
    }
  };
}
