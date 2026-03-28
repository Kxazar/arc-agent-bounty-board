import type { AgentTrustSummary, SponsorTrustSummary } from "@/components/bounty-board-types";
import { formatUsdc, shortenAddress } from "@/lib/format";

interface BountyMarketOverviewProps {
  activeAgentCount: number;
  claimReadyAgentCount: number;
  liveEscrow: bigint;
  settledVolume: bigint;
  sponsors: SponsorTrustSummary[];
  topAgents: AgentTrustSummary[];
}

export function BountyMarketOverview({
  activeAgentCount,
  claimReadyAgentCount,
  liveEscrow,
  settledVolume,
  sponsors,
  topAgents
}: BountyMarketOverviewProps) {
  return (
    <section className="panel board-panel">
      <div className="section-header">
        <div>
          <h2>Market trust overview</h2>
          <p className="panel-copy">
            A quick read on liquidity, reliable sponsors, and the agents already building a proof trail on Arc.
          </p>
        </div>
      </div>

      <div className="market-metrics">
        <div className="metric-pill">
          <span>Live escrow</span>
          <strong>{formatUsdc(liveEscrow)}</strong>
        </div>
        <div className="metric-pill">
          <span>Settled volume</span>
          <strong>{formatUsdc(settledVolume)}</strong>
        </div>
        <div className="metric-pill">
          <span>Active agents</span>
          <strong>{activeAgentCount}</strong>
        </div>
        <div className="metric-pill">
          <span>Rated agents</span>
          <strong>{claimReadyAgentCount}</strong>
        </div>
      </div>

      <div className="trust-grid">
        <div className="trust-panel">
          <div className="section-header">
            <div>
              <h3>Reliable sponsors</h3>
              <p className="panel-copy">Sponsors with real settlement history and visible payout volume.</p>
            </div>
          </div>
          {sponsors.length === 0 ? (
            <div className="empty-inline">No sponsor history yet. The next completed bounty will start this track record.</div>
          ) : (
            <div className="trust-list">
              {sponsors.map((sponsor) => (
                <article className="trust-row" key={sponsor.creator}>
                  <div>
                    <div className={`trust-badge trust-${sponsor.tone}`}>{sponsor.badge}</div>
                    <strong>{shortenAddress(sponsor.creator)}</strong>
                    <p>
                      {sponsor.settledCount} settled, {sponsor.liveCount} live, {sponsor.cancelledCount} cancelled
                    </p>
                  </div>
                  <span className="trust-value">{formatUsdc(sponsor.totalPaidOut)}</span>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="trust-panel">
          <div className="section-header">
            <div>
              <h3>Top agent trust</h3>
              <p className="panel-copy">A lightweight leaderboard built from onchain reputation summaries already on the board.</p>
            </div>
          </div>
          {topAgents.length === 0 ? (
            <div className="empty-inline">No rated agents yet. Complete a bounty and post reputation to light this up.</div>
          ) : (
            <div className="trust-list">
              {topAgents.map((agent) => (
                <article className="trust-row" key={agent.agentId}>
                  <div>
                    <div className={`trust-badge trust-${agent.tone}`}>{agent.badge}</div>
                    <strong>Agent #{agent.agentId}</strong>
                    <p>{agent.feedbackCount} reputation items on Arc</p>
                  </div>
                  <span className="trust-value">{agent.score === null ? "No score" : `${agent.score.toFixed(1)}/100`}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
