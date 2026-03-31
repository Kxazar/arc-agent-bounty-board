import type { TreasurySnapshot } from "@/lib/treasury-types";

interface TreasuryEventsFeedProps {
  snapshot: TreasurySnapshot;
}

export function TreasuryEventsFeed({ snapshot }: TreasuryEventsFeedProps) {
  const isLive = snapshot.mode === "live";

  return (
    <div className="panel">
      <h3>Treasury events</h3>
      <p className="panel-copy">
        {isLive
          ? "A compact feed for live deposit, bridge, and Arc-ready funding milestones persisted through Supabase."
          : "A compact feed for deposit, bridge, and Arc-ready funding milestones inspired by the Arc Fintech starter workflow."}
      </p>

      {snapshot.events.length === 0 ? (
        <div className="empty-inline">No treasury events yet. Create the treasury to start the funding timeline.</div>
      ) : (
        <div className="profile-activity-list">
          {snapshot.events.map((event) => (
            <article className="profile-activity-card" key={event.id}>
              <div className="action-center-top">
                <span className="card-label">{event.kind.replaceAll("_", " ")}</span>
                <span className={`trust-badge trust-${event.status === "warning" ? "warm" : event.status === "success" ? "accent" : "neutral"}`}>
                  {event.status}
                </span>
              </div>
              <div>
                <h3>{event.title}</h3>
                <p>{event.detail}</p>
              </div>
              <div className="workspace-meta">
                <span>{new Date(event.createdAt).toLocaleString()}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
