import { statusLabels } from "@/components/bounty-board-config";
import type { BountyView } from "@/components/bounty-board-types";
import { formatUsdc } from "@/lib/format";

interface MyBountiesWorkspaceProps {
  myBounties: BountyView[];
  onEditBounty: (bounty: BountyView) => void;
  onOpenReview: (bounty: BountyView) => void;
  onOpenDiscussion: (bounty: BountyView) => void;
}

export function MyBountiesWorkspace({
  myBounties,
  onEditBounty,
  onOpenReview,
  onOpenDiscussion
}: MyBountiesWorkspaceProps) {
  return (
    <section className="panel board-panel">
      <div className="section-header">
        <div>
          <h2>My bounties</h2>
          <p className="panel-copy">
            View the bounties you created, reopen them in the editor, and manage sponsor-side follow-ups.
          </p>
        </div>
      </div>

      {myBounties.length === 0 ? (
        <div className="empty-state">No sponsor bounties from this wallet yet.</div>
      ) : (
        <div className="workspace-list">
          {myBounties.map((bounty) => (
            <article className="workspace-card" key={`workspace-${bounty.id.toString()}`}>
              <div>
                <span className="card-label">#{bounty.id.toString()}</span>
                <h3>{bounty.title}</h3>
                <p>{bounty.summary}</p>
              </div>
              <div className="workspace-meta">
                <span>{formatUsdc(bounty.remainingAmount)} left</span>
                <span>
                  {bounty.milestoneCount > 1
                    ? `${bounty.releasedMilestones}/${bounty.milestoneCount} milestones released`
                    : "Single payout"}
                </span>
                <span>{statusLabels[bounty.status] ?? "Unknown"}</span>
              </div>
              <div className="card-actions">
                {bounty.status === 0 ? (
                  <button className="button button-secondary" onClick={() => onEditBounty(bounty)} type="button">
                    Edit bounty
                  </button>
                ) : null}
                {bounty.status === 2 ? (
                  <button className="button button-secondary" onClick={() => onOpenReview(bounty)} type="button">
                    Review submission
                  </button>
                ) : null}
                <button className="button button-ghost" onClick={() => onOpenDiscussion(bounty)} type="button">
                  Open discussion
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
