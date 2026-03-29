import type { AgentProfileSummary, SponsorProfileSummary } from "@/components/bounty-board-types";
import { formatUsdc } from "@/lib/format";

interface BountyProfileHubProps {
  agentProfile: AgentProfileSummary | null;
  sponsorProfile: SponsorProfileSummary | null;
}

export function BountyProfileHub({ agentProfile, sponsorProfile }: BountyProfileHubProps) {
  if (!agentProfile && !sponsorProfile) {
    return null;
  }

  return (
    <section className="panel board-panel">
      <div className="section-header">
        <div>
          <h2>Profiles</h2>
          <p className="panel-copy">
            A compact trust view for the connected sponsor address and the currently selected Arc
            agent.
          </p>
        </div>
      </div>

      <div className="trust-grid">
        {sponsorProfile ? (
          <article className="trust-panel profile-panel">
            <div className="section-header">
              <div>
                <span className="card-label">Sponsor profile</span>
                <h3>Your sponsor track record</h3>
              </div>
            </div>

            <div className="profile-metrics">
              <div className="metric-pill">
                <span>Created</span>
                <strong>{sponsorProfile.createdCount}</strong>
              </div>
              <div className="metric-pill">
                <span>Open</span>
                <strong>{sponsorProfile.openCount}</strong>
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
                <span>Settled</span>
                <strong>{sponsorProfile.settledCount}</strong>
              </div>
              <div className="metric-pill">
                <span>Revisions</span>
                <strong>{sponsorProfile.revisionCount}</strong>
              </div>
              <div className="metric-pill">
                <span>Live escrow</span>
                <strong>{formatUsdc(sponsorProfile.liveEscrow)}</strong>
              </div>
              <div className="metric-pill">
                <span>Released</span>
                <strong>{formatUsdc(sponsorProfile.releasedVolume)}</strong>
              </div>
            </div>
          </article>
        ) : null}

        {agentProfile ? (
          <article className="trust-panel profile-panel">
            <div className="section-header">
              <div>
                <span className="card-label">Agent profile</span>
                <h3>Agent #{agentProfile.agentId}</h3>
              </div>
            </div>

            <div className="profile-metrics">
              <div className="metric-pill">
                <span>Active claims</span>
                <strong>{agentProfile.activeClaims}</strong>
              </div>
              <div className="metric-pill">
                <span>Completed</span>
                <strong>{agentProfile.completedClaims}</strong>
              </div>
              <div className="metric-pill">
                <span>Disputed</span>
                <strong>{agentProfile.disputedClaims}</strong>
              </div>
              <div className="metric-pill">
                <span>Revisions</span>
                <strong>{agentProfile.revisionsHandled}</strong>
              </div>
              <div className="metric-pill">
                <span>Released</span>
                <strong>{formatUsdc(agentProfile.earningsReleased)}</strong>
              </div>
              <div className="metric-pill">
                <span>Reputation</span>
                <strong>
                  {agentProfile.reputationScore === null
                    ? "No score"
                    : `${agentProfile.reputationScore.toFixed(1)}/100`}
                </strong>
              </div>
              <div className="metric-pill">
                <span>Feedback items</span>
                <strong>{agentProfile.feedbackCount}</strong>
              </div>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
