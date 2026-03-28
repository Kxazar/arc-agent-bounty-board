"use client";

import Image from "next/image";
import { useState } from "react";
import { formatUnits } from "viem";

import { BountyAboutSection } from "@/components/bounty-about-section";
import { BountyCard } from "@/components/bounty-card";
import { externalLinkProps, statusLabels } from "@/components/bounty-board-config";
import { BountyBoardControls } from "@/components/bounty-board-controls";
import { BountyBoardReadiness } from "@/components/bounty-board-readiness";
import { BountyClaimStudio } from "@/components/bounty-claim-studio";
import { BountyCreateStudio } from "@/components/bounty-create-studio";
import { BountyDeliveryStudio } from "@/components/bounty-delivery-studio";
import { BountyDiscussionModal } from "@/components/bounty-discussion-modal";
import { BountyMarketOverview } from "@/components/bounty-market-overview";
import { BountyRoadmapSection } from "@/components/bounty-roadmap-section";
import { FeaturedBountiesStrip } from "@/components/featured-bounties-strip";
import { MyBountiesWorkspace } from "@/components/my-bounties-workspace";
import { NanopaymentsPanel } from "@/components/nanopayments-panel";
import type {
  AgentTrustSummary,
  BoardScopeFilter,
  BoardSortOption,
  BoardStatusFilter,
  BountyView,
  FeaturedBountySpotlight,
  SponsorTrustSummary,
  TrustTone
} from "@/components/bounty-board-types";
import { useBountyBoard } from "@/hooks/use-bounty-board";
import type { ReputationSummary } from "@/lib/agent-tools";
import { ARC_CONTRACTS, arcTestnet } from "@/lib/arc";
import { explorerAddressLink, explorerTxLink, formatUsdc, shortenAddress } from "@/lib/format";

function fallbackDiscussionDraft() {
  return {
    text: "",
    attachmentName: "",
    attachmentUrl: "",
    attachmentDataUrl: ""
  };
}

function fallbackReputationDraft(title: string) {
  return {
    score: "95",
    tag1: "successful_delivery",
    tag2: "arc_bounty",
    note: `Settled "${title}" successfully on Arc.`
  };
}

const statusCodeByFilter: Record<Exclude<BoardStatusFilter, "all">, number> = {
  open: 0,
  claimed: 1,
  submitted: 2,
  revision_requested: 3,
  approved: 4,
  disputed: 5,
  cancelled: 6
};

function describeCompactDeadline(timestamp: bigint) {
  if (timestamp === 0n) return "No active window";

  const deltaMs = Number(timestamp) * 1000 - Date.now();
  const absoluteMinutes = Math.max(0, Math.floor(Math.abs(deltaMs) / 60000));
  const days = Math.floor(absoluteMinutes / 1_440);
  const hours = Math.floor((absoluteMinutes % 1_440) / 60);
  const minutes = absoluteMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 && parts.length < 2) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0 && parts.length < 2) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push("1m");

  return deltaMs >= 0 ? `${parts.join(" ")} left` : `${parts.join(" ")} overdue`;
}

function getSponsorBadge(summary: Omit<SponsorTrustSummary, "badge" | "tone">): { badge: string; tone: TrustTone } {
  if (summary.settledCount >= 2 && summary.cancelledCount === 0) {
    return { badge: "Reliable sponsor", tone: "accent" };
  }

  if (summary.settledCount >= 1) {
    return { badge: "Settled sponsor", tone: "warm" };
  }

  if (summary.totalCreated >= 2) {
    return { badge: "Active sponsor", tone: "neutral" };
  }

  return { badge: "New sponsor", tone: "neutral" };
}

function buildSponsorTrustMap(bounties: BountyView[]) {
  const grouped = new Map<string, Omit<SponsorTrustSummary, "badge" | "tone">>();

  for (const bounty of bounties) {
    const key = bounty.creator.toLowerCase();
    const current = grouped.get(key) ?? {
      creator: bounty.creator,
      totalCreated: 0,
      settledCount: 0,
      liveCount: 0,
      cancelledCount: 0,
      totalPaidOut: 0n
    };

    current.totalCreated += 1;

    if (bounty.status === 4) {
      current.settledCount += 1;
      current.totalPaidOut += bounty.payoutAmount;
    } else if (bounty.status === 6) {
      current.cancelledCount += 1;
    } else {
      current.liveCount += 1;
    }

    grouped.set(key, current);
  }

  return Object.fromEntries(
    [...grouped.entries()].map(([key, value]) => {
      const badge = getSponsorBadge(value);
      return [key, { ...value, ...badge } satisfies SponsorTrustSummary];
    })
  ) as Record<string, SponsorTrustSummary>;
}

function buildAgentTrustEntries(reputationByAgent: Record<string, ReputationSummary>): AgentTrustSummary[] {
  return Object.entries(reputationByAgent)
    .map(([agentId, summary]) => {
      const badge =
        summary.count >= 2 && summary.score !== null && summary.score >= 90
          ? { badge: "Trusted closer", tone: "accent" as TrustTone }
          : summary.count >= 1 && summary.score !== null
            ? { badge: "Rated agent", tone: "warm" as TrustTone }
            : { badge: "Fresh profile", tone: "neutral" as TrustTone };

      return {
        agentId,
        score: summary.score,
        feedbackCount: summary.count,
        badge: badge.badge,
        tone: badge.tone
      } satisfies AgentTrustSummary;
    })
    .sort((left, right) => {
      const leftScore = left.score ?? 0;
      const rightScore = right.score ?? 0;

      if (leftScore === rightScore) {
        return right.feedbackCount - left.feedbackCount;
      }

      return rightScore - leftScore;
    });
}

function buildFeaturedBounties(
  bounties: BountyView[],
  sponsorTrustByCreator: Record<string, SponsorTrustSummary>
): FeaturedBountySpotlight[] {
  const nowMs = Date.now();

  return bounties
    .filter((bounty) => bounty.status === 0)
    .map((bounty) => {
      const sponsorTrust = sponsorTrustByCreator[bounty.creator.toLowerCase()];
      const payout = Number(bounty.payoutAmount) / 1_000_000;
      const hoursLeft = Math.max(0, (Number(bounty.claimDeadline) * 1000 - nowMs) / 3_600_000);
      const score =
        payout * 100 +
        (hoursLeft <= 12 ? 30 : hoursLeft <= 24 ? 18 : hoursLeft <= 48 ? 10 : 0) +
        (sponsorTrust?.settledCount ?? 0) * 12;

      let reason = "Fast demo path";

      if (payout >= 0.9) {
        reason = "High reward";
      } else if (hoursLeft <= 12) {
        reason = "Closing soon";
      } else if (sponsorTrust?.tone === "accent") {
        reason = "Reliable sponsor";
      } else if (sponsorTrust?.settledCount) {
        reason = "Settled sponsor";
      }

      return {
        bounty,
        reason,
        urgencyLabel: describeCompactDeadline(bounty.claimDeadline),
        sponsorTrust,
        score
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((spotlight) => ({
      bounty: spotlight.bounty,
      reason: spotlight.reason,
      urgencyLabel: spotlight.urgencyLabel,
      sponsorTrust: spotlight.sponsorTrust
    }));
}

function getActiveDeadlineValue(bounty: BountyView) {
  if (bounty.status === 0) return bounty.claimDeadline;
  if (bounty.status === 1) return bounty.submissionDeadline;
  if (bounty.status === 2) return bounty.reviewDeadline;
  if (bounty.status === 3) return bounty.submissionDeadline;
  return 0n;
}

function isActionNeededForAddress(bounty: BountyView, lowerAddress?: string) {
  if (!lowerAddress) return false;

  const isCreator = bounty.creator.toLowerCase() === lowerAddress;
  const isClaimant = bounty.claimant.toLowerCase() === lowerAddress;

  if (bounty.status === 0) return !isCreator;
  if (bounty.status === 1) return isClaimant;
  if (bounty.status === 2) return isCreator || isClaimant;
  if (bounty.status === 3) return isCreator || isClaimant;
  if (bounty.status === 4) return isCreator;
  if (bounty.status === 5) return isCreator || isClaimant;
  return false;
}

function matchesScopeFilter(bounty: BountyView, scopeFilter: BoardScopeFilter, lowerAddress?: string) {
  if (scopeFilter === "all") return true;
  if (scopeFilter === "open") return bounty.status === 0;
  if (!lowerAddress) return false;
  if (scopeFilter === "created") return bounty.creator.toLowerCase() === lowerAddress;
  if (scopeFilter === "claimed") return bounty.claimant.toLowerCase() === lowerAddress;
  return isActionNeededForAddress(bounty, lowerAddress);
}

export function BountyBoardApp() {
  const { wallet, board, forms, ui, meta, actions } = useBountyBoard();
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<BoardStatusFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<BoardScopeFilter>("all");
  const [sortBy, setSortBy] = useState<BoardSortOption>("newest");

  const {
    address,
    isConnected,
    isOnArc,
    connectors,
    isConnecting,
    isSwitching,
    connectWallet,
    disconnectWallet,
    switchToArc,
    walletUsdc
  } = wallet;
  const {
    bounties,
    myBounties,
    ownedAgents,
    selectedAgent,
    selectedAgentReputation,
    selectedBounty,
    preparedResultBounty,
    editingBounty,
    activeDiscussionBounty,
    activeDiscussionDraft,
    activeDiscussionMessages,
    activeAgentCount,
    reviewDrafts,
    reputationByAgent,
    reputationDrafts,
    reputationReceipts
  } = board;
  const { createForm, setCreateForm, claimForm, setClaimForm, resultForm, setResultForm } = forms;
  const {
    activeTab,
    setActiveTab,
    notice,
    error,
    lastHash,
    isWriting,
    isLoadingBounties,
    isLoadingAgents,
    isPostingReputationFor,
    isLoadingMessagesFor,
    isPostingMessageFor,
    isFormatMenuOpen,
    isAttachmentMenuOpen,
    activeReputationBountyId,
    activeReviewBountyId,
    activeDiscussionBountyId,
    agentLookupError,
    discussionTextareaRef
  } = ui;
  const { hasBountyBoardAddress, bountyBoardAddress } = meta;
  const {
    refreshBoard,
    resetCreateStudio,
    handleSelectAgent,
    primeClaimFlow,
    primeResultFlow,
    primeEditFlow,
    openReviewComposer,
    openDiscussion,
    closeDiscussion,
    updateDiscussionDraft,
    applyTextStyle,
    handleAttachmentFileChange,
    clearAttachment,
    handleCreateBounty,
    claimSpecificBounty,
    handleClaimBounty,
    handleSubmitResult,
    approveBounty,
    requestChanges,
    openDispute,
    cancelUnclaimedBounty,
    reclaimExpiredClaim,
    releaseAfterReviewTimeout,
    openReputationComposer,
    updateReviewDraft,
    updateReputationDraft,
    handlePostReputation,
    handlePostMessage,
    toggleFormatMenu,
    toggleAttachmentMenu
  } = actions;
  const normalizedAddress = address?.toLowerCase();
  const normalizedSearch = searchValue.trim().toLowerCase();
  const filteredBounties = [...bounties]
    .filter((bounty) => {
      if (statusFilter !== "all" && bounty.status !== statusCodeByFilter[statusFilter]) {
        return false;
      }

      if (!matchesScopeFilter(bounty, scopeFilter, normalizedAddress)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        bounty.id.toString(),
        bounty.title,
        bounty.summary,
        bounty.contact,
        bounty.reviewNote,
        bounty.disputeNote,
        bounty.agentId === 0n ? "" : bounty.agentId.toString()
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    })
    .sort((left, right) => {
      if (sortBy === "reward") {
        if (left.payoutAmount === right.payoutAmount) return Number(right.id - left.id);
        return left.payoutAmount > right.payoutAmount ? -1 : 1;
      }

      if (sortBy === "deadline") {
        const leftDeadline = getActiveDeadlineValue(left);
        const rightDeadline = getActiveDeadlineValue(right);

        if (leftDeadline === 0n && rightDeadline === 0n) return Number(right.id - left.id);
        if (leftDeadline === 0n) return 1;
        if (rightDeadline === 0n) return -1;
        if (leftDeadline === rightDeadline) return Number(right.id - left.id);
        return leftDeadline < rightDeadline ? -1 : 1;
      }

      return Number(right.id - left.id);
    });
  const openCount = bounties.filter((bounty) => bounty.status === 0).length;
  const reviewQueueCount = bounties.filter((bounty) => bounty.status === 2 || bounty.status === 3 || bounty.status === 5).length;
  const actionNeededCount = bounties.filter((bounty) => isActionNeededForAddress(bounty, normalizedAddress)).length;
  const briefTargets = bounties
    .filter((bounty) => bounty.status !== 6)
    .slice(0, 8)
    .map((bounty) => ({
      id: bounty.id.toString(),
      title: bounty.title,
      statusLabel: statusLabels[bounty.status] ?? "Unknown"
    }));
  const sponsorTrustByCreator = buildSponsorTrustMap(bounties);
  const topSponsors = Object.values(sponsorTrustByCreator)
    .sort((left, right) => {
      if (left.settledCount === right.settledCount) {
        if (left.totalPaidOut === right.totalPaidOut) {
          return right.totalCreated - left.totalCreated;
        }

        return left.totalPaidOut > right.totalPaidOut ? -1 : 1;
      }

      return right.settledCount - left.settledCount;
    })
    .slice(0, 3);
  const agentTrustEntries = buildAgentTrustEntries(reputationByAgent);
  const featuredBounties = buildFeaturedBounties(bounties, sponsorTrustByCreator);
  const liveEscrow = bounties
    .filter((bounty) => bounty.status === 0 || bounty.status === 1 || bounty.status === 2 || bounty.status === 3 || bounty.status === 5)
    .reduce((sum, bounty) => sum + bounty.payoutAmount, 0n);
  const settledVolume = bounties
    .filter((bounty) => bounty.status === 4)
    .reduce((sum, bounty) => sum + bounty.payoutAmount, 0n);
  const hasActiveBoardFilters =
    normalizedSearch !== "" || statusFilter !== "all" || scopeFilter !== "all" || sortBy !== "newest";

  function resetBoardView() {
    setSearchValue("");
    setStatusFilter("all");
    setScopeFilter("all");
    setSortBy("newest");
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="brand-row">
              <Image
                alt="Arc Agent Bounty Board logo"
                className="brand-mark"
                height={72}
                src="/brand/arc-bounty-mark.svg"
                width={72}
              />
              <div className="brand-copy">
                <span className="brand-title">Arc Agent Bounty Board</span>
                <span className="brand-subtitle">Stablecoin task ops for Arc-native agents</span>
              </div>
            </div>
            <div className="eyebrow">Arc-native stablecoin payouts for AI agents</div>
            <h1>Arc Agent Bounty Board</h1>
            <p className="lede">
              A compact marketplace where sponsors lock USDC in escrow, Arc agents claim work
              through ERC-8004 identity, pass sponsor review, and settle on Arc Testnet in a single
              clean flow.
            </p>

            <div className="hero-actions">
              {!isConnected ? (
                <button
                  className="button button-primary"
                  disabled={isConnecting || connectors.length === 0}
                  onClick={connectWallet}
                  type="button"
                >
                  {connectors.length === 0 ? "Install a wallet" : "Connect Wallet"}
                </button>
              ) : (
                <>
                  <button
                    className="button button-primary"
                    disabled={isSwitching || isOnArc}
                    onClick={() => {
                      void switchToArc();
                    }}
                    type="button"
                  >
                    {isOnArc ? "On Arc Testnet" : "Switch To Arc"}
                  </button>
                  <button className="button button-secondary" onClick={() => disconnectWallet()} type="button">
                    Disconnect
                  </button>
                </>
              )}
            </div>

            <div className="hero-band">
              <div className="hero-band-card">
                <span className="card-label">01</span>
                <strong>Fund in USDC</strong>
                <p>Escrow the payout directly on Arc with predictable fees and clean sponsor controls.</p>
              </div>
              <div className="hero-band-card">
                <span className="card-label">02</span>
                <strong>Claim with agentId</strong>
                <p>Use real ERC-8004 identity, surface owned agents, and reduce copy-paste during the demo.</p>
              </div>
              <div className="hero-band-card">
                <span className="card-label">03</span>
                <strong>Review, settle, build trust</strong>
                <p>Creators review submissions before payout, can request changes or dispute, then close with reputation.</p>
              </div>
            </div>
          </div>

          <div className="panel stats-panel">
            <div className="stat-row">
              <span>Wallet</span>
              <strong>{shortenAddress(address)}</strong>
            </div>
            <div className="stat-row">
              <span>Network</span>
              <strong>{isOnArc ? "Arc Testnet" : "Wrong network"}</strong>
            </div>
            <div className="stat-row">
              <span>USDC balance</span>
              <strong>{typeof walletUsdc === "bigint" ? formatUsdc(walletUsdc) : "Connect wallet"}</strong>
            </div>
            <div className="stat-row">
              <span>Owned agents</span>
              <strong>{isConnected ? ownedAgents.length : 0}</strong>
            </div>
            <div className="stat-row">
              <span>Active agents</span>
              <strong>{activeAgentCount}</strong>
            </div>
            <div className="stat-row">
              <span>IdentityRegistry</span>
              <a {...externalLinkProps} href={explorerAddressLink(ARC_CONTRACTS.identityRegistry)}>
                Open on Arcscan
              </a>
            </div>
            <div className="stat-row">
              <span>Bounty contract</span>
              <strong>{hasBountyBoardAddress ? shortenAddress(bountyBoardAddress) : "Not configured"}</strong>
            </div>
            <div className="stat-row">
              <span>Selected agent</span>
              <strong>{selectedAgent ? `#${selectedAgent.agentId.toString()}` : "Choose below"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Application sections" className="tab-bar" role="tablist">
        <button
          aria-selected={activeTab === "board"}
          className={`tab-button ${activeTab === "board" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("board")}
          role="tab"
          type="button"
        >
          Board
        </button>
        <button
          aria-selected={activeTab === "about"}
          className={`tab-button ${activeTab === "about" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("about")}
          role="tab"
          type="button"
        >
          About
        </button>
        <button
          aria-selected={activeTab === "roadmap"}
          className={`tab-button ${activeTab === "roadmap" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("roadmap")}
          role="tab"
          type="button"
        >
          Roadmap
        </button>
      </section>

      {activeTab === "board" ? (
        <>
          {!hasBountyBoardAddress ? (
            <section className="panel alert-panel">
              <h2>Deployment gate</h2>
              <p>
                The frontend is ready, but it needs a deployed ArcBountyBoard address. Add it to{" "}
                <code>.env.local</code> as <code>NEXT_PUBLIC_BOUNTY_BOARD_ADDRESS</code> and restart the app.
              </p>
            </section>
          ) : null}

          <BountyBoardReadiness
            hasBountyBoardAddress={hasBountyBoardAddress}
            isConnected={isConnected}
            isOnArc={isOnArc}
            ownedAgentCount={ownedAgents.length}
            selectedAgentLabel={selectedAgent ? `agent #${selectedAgent.agentId.toString()}` : undefined}
          />

          <BountyMarketOverview
            activeAgentCount={activeAgentCount}
            claimReadyAgentCount={agentTrustEntries.filter((entry) => entry.feedbackCount > 0).length}
            liveEscrow={liveEscrow}
            settledVolume={settledVolume}
            sponsors={topSponsors}
            topAgents={agentTrustEntries.slice(0, 3)}
          />

          <NanopaymentsPanel
            bountyBoardAddress={hasBountyBoardAddress ? bountyBoardAddress : undefined}
            briefTargets={briefTargets}
            disputedCount={bounties.filter((bounty) => bounty.status === 5).length}
            openCount={openCount}
            reviewQueueCount={reviewQueueCount}
          />

          <FeaturedBountiesStrip
            connectedAddress={address}
            featuredBounties={featuredBounties}
            isSwitching={isSwitching}
            isWriting={isWriting}
            selectedClaimAgentId={claimForm.agentId}
            onPrimeClaim={primeClaimFlow}
            onPrimeEdit={primeEditFlow}
            onQuickClaim={(bountyId, agentId) => {
              void claimSpecificBounty(bountyId, agentId);
            }}
          />

          <section className="grid-two">
            <BountyCreateStudio
              createForm={createForm}
              editingBounty={editingBounty}
              isSwitching={isSwitching}
              isWriting={isWriting}
              setCreateForm={setCreateForm}
              onCancelEdit={resetCreateStudio}
              onSubmit={() => {
                void handleCreateBounty();
              }}
            />

            <div className="stack">
              <BountyClaimStudio
                agentLookupError={agentLookupError}
                claimForm={claimForm}
                isLoadingAgents={isLoadingAgents}
                isSwitching={isSwitching}
                isWriting={isWriting}
                ownedAgents={ownedAgents}
                reputationByAgent={reputationByAgent}
                selectedAgent={selectedAgent}
                selectedAgentReputation={selectedAgentReputation}
                selectedBounty={selectedBounty}
                setClaimForm={setClaimForm}
                onClaim={() => {
                  void handleClaimBounty();
                }}
                onSelectAgent={handleSelectAgent}
              />

              <BountyDeliveryStudio
                isSwitching={isSwitching}
                isWriting={isWriting}
                preparedResultBounty={preparedResultBounty}
                resultForm={resultForm}
                setResultForm={setResultForm}
                onSubmit={() => {
                  void handleSubmitResult();
                }}
              />
            </div>
          </section>

          {isConnected ? (
            <MyBountiesWorkspace
              myBounties={myBounties}
              onEditBounty={primeEditFlow}
              onOpenReview={openReviewComposer}
              onOpenDiscussion={(bounty) => {
                void openDiscussion(bounty);
              }}
            />
          ) : null}

          <section className="panel board-panel">
            <div className="section-header">
              <div>
                <h2>Live bounty board</h2>
                <p className="panel-copy">
                  The board reads recent bounties directly from the deployed contract and now helps
                  people discover the right task, role, and next move much faster.
                </p>
              </div>
              <button
                className="button button-secondary"
                onClick={() => {
                  void refreshBoard();
                }}
                type="button"
              >
                Refresh
              </button>
            </div>

            <BountyBoardControls
              actionNeededCount={actionNeededCount}
              hasActiveFilters={hasActiveBoardFilters}
              onReset={resetBoardView}
              onScopeFilterChange={setScopeFilter}
              onSearchChange={setSearchValue}
              onSortByChange={setSortBy}
              onStatusFilterChange={setStatusFilter}
              openCount={openCount}
              scopeFilter={scopeFilter}
              searchValue={searchValue}
              sortBy={sortBy}
              statusFilter={statusFilter}
              totalCount={bounties.length}
              visibleCount={filteredBounties.length}
            />

            {bounties.length === 0 ? (
              <div className="empty-state">
                {isLoadingBounties ? "Loading bounties from Arc..." : "No bounties yet. Create the first one."}
              </div>
            ) : filteredBounties.length === 0 ? (
              <div className="empty-state">
                No bounties match this view right now. Reset the board filters or widen the search.
              </div>
            ) : (
              <div className="bounty-list">
                {filteredBounties.map((bounty) => {
                  const bountyKey = bounty.id.toString();

                  return (
                    <BountyCard
                      bounty={bounty}
                      connectedAddress={address}
                      isComposerOpen={activeReputationBountyId === bountyKey}
                      isReviewOpen={activeReviewBountyId === bountyKey}
                      isDiscussionOpen={activeDiscussionBountyId === bountyKey}
                      isPostingReputation={isPostingReputationFor === bountyKey}
                      isSwitching={isSwitching}
                      isWriting={isWriting}
                      key={bountyKey}
                      ownedAgentCount={ownedAgents.length}
                      reputation={bounty.agentId > 0n ? reputationByAgent[bounty.agentId.toString()] : undefined}
                      reviewDraft={reviewDrafts[bountyKey] ?? { note: `Reviewing "${bounty.title}" on Arc.` }}
                      reputationDraft={reputationDrafts[bountyKey] ?? fallbackReputationDraft(bounty.title)}
                      reputationReceipt={reputationReceipts[bountyKey]}
                      selectedClaimAgentId={claimForm.agentId}
                      sponsorTrust={sponsorTrustByCreator[bounty.creator.toLowerCase()]}
                      onApprove={(targetBounty) => {
                        void approveBounty(targetBounty);
                      }}
                      onCancelAfterDeadline={(targetBounty) => {
                        void cancelUnclaimedBounty(targetBounty);
                      }}
                      onOpenDiscussion={(targetBounty) => {
                        void openDiscussion(targetBounty);
                      }}
                      onOpenDispute={(targetBounty) => {
                        void openDispute(targetBounty);
                      }}
                      onOpenReviewComposer={openReviewComposer}
                      onOpenReputationComposer={openReputationComposer}
                      onPrimeClaim={primeClaimFlow}
                      onPrimeEdit={primeEditFlow}
                      onPrimeSubmit={primeResultFlow}
                      onQuickClaim={(bountyId, agentId) => {
                        void claimSpecificBounty(bountyId, agentId);
                      }}
                      onRecoverAfterMissedSubmit={(targetBounty) => {
                        void reclaimExpiredClaim(targetBounty);
                      }}
                      onRequestChanges={(targetBounty) => {
                        void requestChanges(targetBounty);
                      }}
                      onReleaseAfterTimeout={(targetBounty) => {
                        void releaseAfterReviewTimeout(targetBounty);
                      }}
                      onSubmitReputation={(targetBounty) => {
                        void handlePostReputation(targetBounty);
                      }}
                      onUpdateReviewDraft={updateReviewDraft}
                      onUpdateReputationDraft={updateReputationDraft}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section className="grid-two compact-grid">
            <div className="panel">
              <h2>Demo script</h2>
              <ol className="ordered-list">
              <li>Claim test USDC from the Arc faucet and connect on Arc Testnet.</li>
              <li>Pick one of the seeded bounty cards or create your own task.</li>
              <li>Claim it with a registered Arc agent ID.</li>
              <li>Use the built-in discussion room to align with the sponsor inside the app.</li>
              <li>Submit a result link, pass sponsor review or iterate on revisions, then record reputation.</li>
              <li>Call the nanopayment feed if you want premium board intelligence through Circle Gateway.</li>
            </ol>
          </div>

          <div className="panel">
            <h2>Useful links</h2>
              <div className="link-list">
                <a {...externalLinkProps} href="https://docs.arc.network/arc/tutorials/register-your-first-ai-agent">
                  Register your first AI agent
                </a>
                <a {...externalLinkProps} href="https://docs.arc.network/arc/tutorials/deploy-on-arc">
                  Deploy on Arc
                </a>
                <a {...externalLinkProps} href="https://developers.circle.com/gateway/nanopayments">
                  Circle Nanopayments
                </a>
                <a {...externalLinkProps} href="https://faucet.circle.com">
                  Circle faucet
                </a>
                {lastHash ? (
                  <a {...externalLinkProps} href={explorerTxLink(lastHash)}>
                    Latest confirmed transaction
                  </a>
                ) : (
                  <span className="muted-line">No confirmed transactions yet.</span>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "about" ? <BountyAboutSection /> : null}

      {activeTab === "roadmap" ? <BountyRoadmapSection /> : null}

      {activeDiscussionBounty ? (
        <BountyDiscussionModal
          bounty={activeDiscussionBounty}
          draft={activeDiscussionDraft ?? fallbackDiscussionDraft()}
          isAttachmentMenuOpen={isAttachmentMenuOpen}
          isFormatMenuOpen={isFormatMenuOpen}
          isLoading={isLoadingMessagesFor === activeDiscussionBounty.id.toString()}
          isPosting={isPostingMessageFor === activeDiscussionBounty.id.toString()}
          key={activeDiscussionBounty.id.toString()}
          messages={activeDiscussionMessages}
          textareaRef={discussionTextareaRef}
          onApplyTextStyle={applyTextStyle}
          onAttachmentFileChange={handleAttachmentFileChange}
          onAttachmentUrlChange={(value) =>
            updateDiscussionDraft((draft) => ({
              ...draft,
              attachmentUrl: value
            }))
          }
          onClearAttachment={clearAttachment}
          onClose={closeDiscussion}
          onSendMessage={() => {
            void handlePostMessage(activeDiscussionBounty);
          }}
          onTextChange={(value) =>
            updateDiscussionDraft((draft) => ({
              ...draft,
              text: value
            }))
          }
          onToggleAttachmentMenu={toggleAttachmentMenu}
          onToggleFormatMenu={toggleFormatMenu}
        />
      ) : null}

      {notice ? <div className="toast toast-info">{notice}</div> : null}
      {error ? <div className="toast toast-error">{error}</div> : null}

      <footer className="footer">
        <span>Arc Testnet chain ID {arcTestnet.id}</span>
        <span>USDC decimals {formatUnits(1_000_000n, 6).replace(".0", "")} baseline</span>
      </footer>
    </main>
  );
}
