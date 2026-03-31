import { formatUsdcString, shortenAddress } from "@/lib/format";
import type { TreasurySnapshot } from "@/lib/treasury-types";

interface TreasuryBalanceCardProps {
  snapshot: TreasurySnapshot;
}

export function TreasuryBalanceCard({ snapshot }: TreasuryBalanceCardProps) {
  return (
    <article className="trust-panel profile-hero-panel">
      <div className="section-header">
        <div>
          <span className="card-label">Treasury overview</span>
          <h3>{snapshot.circleWalletLabel ?? "Treasury not created yet"}</h3>
          <p className="panel-copy">
            This MVP uses a demo-safe treasury state that mirrors the Arc Fintech starter flow: managed treasury, deposit lane, bridge, and Arc balance ready for sponsor operations.
          </p>
        </div>
        <span className="trust-badge trust-warm">{snapshot.mode} mode</span>
      </div>

      <div className="profile-metrics profile-metrics-wide">
        <div className="metric-pill">
          <span>Status</span>
          <strong>{snapshot.status === "ready" ? "Ready" : "Not created"}</strong>
        </div>
        <div className="metric-pill">
          <span>Arc treasury balance</span>
          <strong>{formatUsdcString(snapshot.availableArcUsdc)}</strong>
        </div>
        <div className="metric-pill">
          <span>Total funded</span>
          <strong>{formatUsdcString(snapshot.totalFundedUsdc)}</strong>
        </div>
        <div className="metric-pill">
          <span>Total withdrawn</span>
          <strong>{formatUsdcString(snapshot.totalWithdrawnUsdc)}</strong>
        </div>
        <div className="metric-pill">
          <span>Funding sessions</span>
          <strong>{snapshot.sessions.length}</strong>
        </div>
        <div className="metric-pill">
          <span>Arc lane</span>
          <strong>{snapshot.arcWalletAddress ? shortenAddress(snapshot.arcWalletAddress as `0x${string}`) : "Pending"}</strong>
        </div>
      </div>
    </article>
  );
}
