"use client";

import { useState } from "react";

import { statusLabels } from "@/components/bounty-board-config";
import type { AgentProfileSummary, BountyView, SponsorProfileSummary } from "@/components/bounty-board-types";
import { formatUsdc, formatUsdcString, shortenAddress } from "@/lib/format";
import type { TreasurySnapshot } from "@/lib/treasury-types";

interface BountyProfileHubProps {
  agentProfile: AgentProfileSummary | null;
  sponsorProfile: SponsorProfileSummary | null;
  treasurySnapshot?: TreasurySnapshot | null;
}

function describeMilestoneProgress(bounty: BountyView) {
  if (bounty.milestoneCount <= 1) {
    return "Single payout";
  }

  return `${bounty.releasedMilestones}/${bounty.milestoneCount} milestones released`;
}

function ProfileActivityList({
  emptyLabel,
  items
}: {
  emptyLabel: string;
  items: BountyView[];
}) {
  if (items.length === 0) {
    return <div className="empty-inline">{emptyLabel}</div>;
  }

  return (
    <div className="profile-activity-list">
      {items.map((bounty) => (
        <article className="profile-activity-card" key={`profile-${bounty.id.toString()}`}>
          <div className="action-center-top">
            <span className="card-label">#{bounty.id.toString()}</span>
            <span className="trust-badge trust-neutral">{statusLabels[bounty.status] ?? "Unknown"}</span>
          </div>
          <div>
            <h3>{bounty.title}</h3>
            <p>{bounty.summary}</p>
          </div>
          <div className="workspace-meta">
            <span>{formatUsdc(bounty.remainingAmount)} left</span>
            <span>{describeMilestoneProgress(bounty)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function BountyProfileHub({ agentProfile, sponsorProfile, treasurySnapshot }: BountyProfileHubProps) {
  const [preferredPage, setPreferredPage] = useState<"sponsor" | "agent">(sponsorProfile ? "sponsor" : "agent");

  if (!agentProfile && !sponsorProfile) {
    return null;
  }

  const activePage =
    preferredPage === "sponsor" && !sponsorProfile
      ? "agent"
      : preferredPage === "agent" && !agentProfile
        ? "sponsor"
        : preferredPage;
  const canSwitch = Boolean(agentProfile && sponsorProfile);

  return (
    <section className="panel board-panel">
      <div className="section-header">
        <div>
          <h2>Profile pages</h2>
          <p className="panel-copy">
            Persistent trust views for the connected sponsor wallet and the currently selected Arc agent, with active queues and recent work history.
          </p>
        </div>
      </div>

      {canSwitch ? (
        <div className="profile-tab-row" role="tablist" aria-label="Profile pages">
          <button
            aria-selected={activePage === "sponsor"}
            className={`filter-pill ${activePage === "sponsor" ? "filter-pill-active" : ""}`}
            onClick={() => setPreferredPage("sponsor")}
            role="tab"
            type="button"
          >
            Sponsor page
          </button>
          <button
            aria-selected={activePage === "agent"}
            className={`filter-pill ${activePage === "agent" ? "filter-pill-active" : ""}`}
            onClick={() => setPreferredPage("agent")}
            role="tab"
            type="button"
          >
            Agent page
          </button>
        </div>
      ) : null}

      {activePage === "sponsor" && sponsorProfile ? (
        <div className="profile-stack">
          <article className="trust-panel profile-hero-panel">
            <div className="section-header">
              <div>
                <span className="card-label">Sponsor page</span>
                <h3>{shortenAddress(sponsorProfile.creator)}</h3>
                <p className="panel-copy">
                  A sponsor-side trust page for created bounty volume, payout quality, and live work still waiting on action.
                </p>
              </div>
              <span className={`trust-badge trust-${sponsorProfile.tone}`}>{sponsorProfile.badge}</span>
            </div>

            <div className="profile-metrics profile-metrics-wide">
              <div className="metric-pill">
                <span>Created</span>
                <strong>{sponsorProfile.createdCount}</strong>
              </div>
              <div className="metric-pill">
                <span>Completion</span>
                <strong>{sponsorProfile.completionRate}%</strong>
              </div>
              <div className="metric-pill">
                <span>Dispute rate</span>
                <strong>{sponsorProfile.disputeRate}%</strong>
              </div>
              <div className="metric-pill">
                <span>Action needed</span>
                <strong>{sponsorProfile.actionNeededCount}</strong>
              </div>
              <div className="metric-pill">
                <span>Live escrow</span>
                <strong>{formatUsdc(sponsorProfile.liveEscrow)}</strong>
              </div>
              <div className="metric-pill">
                <span>Released</span>
                <strong>{formatUsdc(sponsorProfile.releasedVolume)}</strong>
              </div>
              <div className="metric-pill">
                <span>Avg reward</span>
                <strong>{formatUsdc(sponsorProfile.averageReward)}</strong>
              </div>
              <div className="metric-pill">
                <span>Largest bounty</span>
                <strong>{formatUsdc(sponsorProfile.largestReward)}</strong>
              </div>
              <div className="metric-pill">
                <span>Milestoned jobs</span>
                <strong>{sponsorProfile.milestoneBountyCount}</strong>
              </div>
              <div className="metric-pill">
                <span>In review</span>
                <strong>{sponsorProfile.inReviewCount}</strong>
              </div>
              <div className="metric-pill">
                <span>Disputed</span>
                <strong>{sponsorProfile.disputedCount}</strong>
              </div>
              <div className="metric-pill">
                <span>Revisions</span>
                <strong>{sponsorProfile.revisionCount}</strong>
              </div>
            </div>

            {treasurySnapshot?.status === "ready" ? (
              <div className="workspace-meta">
                <span>Treasury mode: {treasurySnapshot.mode}</span>
                <span>Arc treasury: {formatUsdcString(treasurySnapshot.availableArcUsdc)}</span>
                <span>Funded volume: {formatUsdcString(treasurySnapshot.totalFundedUsdc)}</span>
              </div>
            ) : null}
          </article>

          <div className="grid-two">
            <div className="panel">
              <h3>Current sponsor queue</h3>
              <p className="panel-copy">
                Live bounties that still have escrow, milestone progress, or a pending sponsor-side decision attached.
              </p>
              <ProfileActivityList
                emptyLabel="No live sponsor bounties right now."
                items={sponsorProfile.activeBounties}
              />
            </div>

            <div className="panel">
              <h3>Recent sponsor activity</h3>
              <p className="panel-copy">
                The most recent bounties created from this wallet, including settled and in-flight work.
              </p>
              <ProfileActivityList
                emptyLabel="No recent sponsor activity yet."
                items={sponsorProfile.recentBounties}
              />
            </div>
          </div>
        </div>
      ) : null}

      {activePage === "agent" && agentProfile ? (
        <div className="profile-stack">
          <article className="trust-panel profile-hero-panel">
            <div className="section-header">
              <div>
                <span className="card-label">Agent page</span>
                <h3>Agent #{agentProfile.agentId}</h3>
                <p className="panel-copy">
                  A selected-agent operating profile with earnings, current claim load, milestone exposure, and reusable trust after settlement.
                </p>
              </div>
              <span className={`trust-badge trust-${agentProfile.tone}`}>{agentProfile.badge}</span>
            </div>

            <div className="profile-metrics profile-metrics-wide">
              <div className="metric-pill">
                <span>Active claims</span>
                <strong>{agentProfile.activeClaims}</strong>
              </div>
              <div className="metric-pill">
                <span>In review</span>
                <strong>{agentProfile.inReviewClaims}</strong>
              </div>
              <div className="metric-pill">
                <span>Completed</span>
                <strong>{agentProfile.completedClaims}</strong>
              </div>
              <div className="metric-pill">
                <span>Success rate</span>
                <strong>{agentProfile.successRate}%</strong>
              </div>
              <div className="metric-pill">
                <span>Disputed</span>
                <strong>{agentProfile.disputedClaims}</strong>
              </div>
              <div className="metric-pill">
                <span>Revisions handled</span>
                <strong>{agentProfile.revisionsHandled}</strong>
              </div>
              <div className="metric-pill">
                <span>Released earnings</span>
                <strong>{formatUsdc(agentProfile.earningsReleased)}</strong>
              </div>
              <div className="metric-pill">
                <span>Pending payout</span>
                <strong>{formatUsdc(agentProfile.pendingPayout)}</strong>
              </div>
              <div className="metric-pill">
                <span>Avg claim value</span>
                <strong>{formatUsdc(agentProfile.averageClaimValue)}</strong>
              </div>
              <div className="metric-pill">
                <span>Milestone claims</span>
                <strong>{agentProfile.milestoneClaimCount}</strong>
              </div>
              <div className="metric-pill">
                <span>Reputation</span>
                <strong>
                  {agentProfile.reputationScore === null ? "No score" : `${agentProfile.reputationScore.toFixed(1)}/100`}
                </strong>
              </div>
              <div className="metric-pill">
                <span>Feedback items</span>
                <strong>{agentProfile.feedbackCount}</strong>
              </div>
            </div>
          </article>

          <div className="grid-two">
            <div className="panel">
              <h3>Current claim queue</h3>
              <p className="panel-copy">
                The claims currently tied to this agent, including deliveries in flight, review states, and disputed work.
              </p>
              <ProfileActivityList
                emptyLabel="No live claims for this agent right now."
                items={agentProfile.activeClaimQueue}
              />
            </div>

            <div className="panel">
              <h3>Recent claim history</h3>
              <p className="panel-copy">
                Recent jobs associated with this selected agent, useful for showing recurring work and payout quality.
              </p>
              <ProfileActivityList
                emptyLabel="No recent claim history for this agent yet."
                items={agentProfile.recentClaims}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
