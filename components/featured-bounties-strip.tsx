import type { Address } from "viem";

import type { FeaturedBountySpotlight } from "@/components/bounty-board-types";
import { formatUsdc, shortenAddress } from "@/lib/format";

interface FeaturedBountiesStripProps {
  connectedAddress?: Address;
  featuredBounties: FeaturedBountySpotlight[];
  isSwitching: boolean;
  isWriting: boolean;
  selectedClaimAgentId: string;
  onPrimeClaim: (bountyId: bigint) => void;
  onPrimeEdit: (bounty: FeaturedBountySpotlight["bounty"]) => void;
  onQuickClaim: (bountyId: string, agentId: string) => void | Promise<void>;
}

export function FeaturedBountiesStrip({
  connectedAddress,
  featuredBounties,
  isSwitching,
  isWriting,
  selectedClaimAgentId,
  onPrimeClaim,
  onPrimeEdit,
  onQuickClaim
}: FeaturedBountiesStripProps) {
  if (featuredBounties.length === 0) {
    return null;
  }

  return (
    <section className="panel board-panel">
      <div className="section-header">
        <div>
          <h2>Featured bounties</h2>
          <p className="panel-copy">
            A curated front page for the most interesting open opportunities on the board right now.
          </p>
        </div>
      </div>

      <div className="featured-grid">
        {featuredBounties.map((spotlight) => {
          const { bounty, reason, urgencyLabel, sponsorTrust } = spotlight;
          const isCreator =
            connectedAddress ? connectedAddress.toLowerCase() === bounty.creator.toLowerCase() : false;
          const canQuickClaim = !isCreator && selectedClaimAgentId !== "";

          return (
            <article className="featured-card" key={`featured-${bounty.id.toString()}`}>
              <div className="featured-head">
                <span className="featured-reason">{reason}</span>
                <span className="status-pill status-open">Open</span>
              </div>

              <div>
                <div className="card-label">#{bounty.id.toString()}</div>
                <h3>{bounty.title}</h3>
                <p>{bounty.summary}</p>
              </div>

              <div className="featured-meta">
                <div>
                  <span>Reward</span>
                  <strong>{formatUsdc(bounty.payoutAmount)}</strong>
                </div>
                <div>
                  <span>Claim window</span>
                  <strong>{urgencyLabel}</strong>
                </div>
                <div>
                  <span>Creator</span>
                  <strong>{shortenAddress(bounty.creator)}</strong>
                </div>
              </div>

              {sponsorTrust ? (
                <div className="featured-trust">
                  <span className={`trust-badge trust-${sponsorTrust.tone}`}>{sponsorTrust.badge}</span>
                  <span>
                    {sponsorTrust.settledCount} settled
                    {sponsorTrust.totalPaidOut > 0n ? ` • ${formatUsdc(sponsorTrust.totalPaidOut)} paid` : ""}
                  </span>
                </div>
              ) : null}

              <div className="card-actions">
                {isCreator ? (
                  <button className="button button-secondary" onClick={() => onPrimeEdit(bounty)} type="button">
                    Refine bounty
                  </button>
                ) : (
                  <button className="button button-secondary" onClick={() => onPrimeClaim(bounty.id)} type="button">
                    Prepare claim
                  </button>
                )}

                {canQuickClaim ? (
                  <button
                    className="button button-primary"
                    disabled={isWriting || isSwitching}
                    onClick={() => onQuickClaim(bounty.id.toString(), selectedClaimAgentId)}
                    type="button"
                  >
                    Claim now
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
