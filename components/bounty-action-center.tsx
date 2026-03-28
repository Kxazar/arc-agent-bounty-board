import type { ActionCenterItem, BountyView } from "@/components/bounty-board-types";

interface BountyActionCenterProps {
  isConnected: boolean;
  items: ActionCenterItem[];
  onOpenDiscussion: (bounty: BountyView) => void;
  onRunAction: (item: ActionCenterItem) => void;
}

export function BountyActionCenter({ isConnected, items, onOpenDiscussion, onRunAction }: BountyActionCenterProps) {
  return (
    <section className="panel board-panel">
      <div className="section-header">
        <div>
          <h2>Action center</h2>
          <p className="panel-copy">
            A personal inbox that turns the board into a step-by-step operating console instead of a passive list.
          </p>
        </div>
        <span className={`readiness-badge ${items.length === 0 ? "readiness-badge-ready" : ""}`}>
          {items.length === 0 ? "Clear" : `${items.length} live`}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="empty-inline">
          {isConnected
            ? "No urgent actions right now. You can scout featured bounties or create the next sponsor brief."
            : "Connect a wallet and the inbox will start prioritizing claim, review, and payout actions for you."}
        </div>
      ) : (
        <div className="action-center-list">
          {items.map((item) => (
            <article className={`action-center-card action-center-${item.tone}`} key={item.id}>
              <div className="action-center-top">
                <span className="card-label">{item.eyebrow}</span>
                <span className={`trust-badge trust-${item.tone}`}>{item.meta}</span>
              </div>
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
              <div className="card-actions">
                <button className="button button-primary" onClick={() => onRunAction(item)} type="button">
                  {item.actionLabel}
                </button>
                {item.allowDiscussion && item.bounty ? (
                  <button className="button button-ghost" onClick={() => onOpenDiscussion(item.bounty!)} type="button">
                    Open discussion
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
