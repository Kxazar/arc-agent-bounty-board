"use client";

import { useState } from "react";

import type { ActionCenterItem, BountyView } from "@/components/bounty-board-types";

type InboxFilter = "all" | "urgent" | "sponsor" | "claimant" | "funding" | "recovery" | "trust";

interface BountyActionCenterProps {
  isConnected: boolean;
  items: ActionCenterItem[];
  onOpenDiscussion: (bounty: BountyView) => void;
  onRunAction: (item: ActionCenterItem) => void;
}

const filterLabels: Record<InboxFilter, string> = {
  all: "All activity",
  urgent: "Urgent",
  sponsor: "Sponsor",
  claimant: "Claimant",
  funding: "Funding",
  recovery: "Recovery",
  trust: "Trust loop"
};

function matchesInboxFilter(item: ActionCenterItem, filter: InboxFilter) {
  if (filter === "all") return true;
  if (filter === "urgent") return item.priority === "urgent";
  if (filter === "sponsor") return item.audience === "sponsor";
  if (filter === "claimant") return item.audience === "claimant";
  if (filter === "funding") return item.category === "funding";
  if (filter === "recovery") return item.category === "recovery";
  return item.category === "trust";
}

function describeAudience(item: ActionCenterItem) {
  if (item.audience === "sponsor") return "Sponsor side";
  if (item.audience === "claimant") return "Claimant side";
  if (item.audience === "shared") return "Shared flow";
  return "Setup";
}

function describeCategory(item: ActionCenterItem) {
  if (item.category === "setup") return "Setup";
  if (item.category === "funding") return "Funding";
  if (item.category === "claim") return "Claim";
  if (item.category === "review") return "Review";
  if (item.category === "delivery") return "Delivery";
  if (item.category === "recovery") return "Recovery";
  return "Trust";
}

export function BountyActionCenter({ isConnected, items, onOpenDiscussion, onRunAction }: BountyActionCenterProps) {
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const filteredItems = items.filter((item) => matchesInboxFilter(item, activeFilter));
  const urgentCount = items.filter((item) => item.priority === "urgent").length;
  const sponsorCount = items.filter((item) => item.audience === "sponsor").length;
  const claimantCount = items.filter((item) => item.audience === "claimant").length;
  const trustCount = items.filter((item) => item.category === "trust").length;

  return (
    <section className="panel board-panel">
      <div className="section-header">
        <div>
          <h2>Notification inbox</h2>
          <p className="panel-copy">
            A prioritized operations queue for review, claimant delivery, recovery windows, and post-settlement trust work.
          </p>
        </div>
        <span className={`readiness-badge ${items.length === 0 ? "readiness-badge-ready" : ""}`}>
          {items.length === 0 ? "Clear" : `${items.length} live`}
        </span>
      </div>

      <div className="inbox-summary-grid">
        <div className="metric-pill">
          <span>Urgent now</span>
          <strong>{urgentCount}</strong>
        </div>
        <div className="metric-pill">
          <span>Sponsor actions</span>
          <strong>{sponsorCount}</strong>
        </div>
        <div className="metric-pill">
          <span>Claimant actions</span>
          <strong>{claimantCount}</strong>
        </div>
        <div className="metric-pill">
          <span>Trust follow-ups</span>
          <strong>{trustCount}</strong>
        </div>
      </div>

      <div className="inbox-filter-row" role="tablist" aria-label="Inbox filters">
        {(Object.keys(filterLabels) as InboxFilter[]).map((filter) => (
          <button
            aria-selected={activeFilter === filter}
            className={`filter-pill ${activeFilter === filter ? "filter-pill-active" : ""}`}
            key={filter}
            onClick={() => setActiveFilter(filter)}
            role="tab"
            type="button"
          >
            {filterLabels[filter]}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty-inline">
          {isConnected
            ? "No items in this inbox view right now. Switch filters or return to the board to pick up the next bounty."
            : "Connect a wallet and the inbox will start prioritizing claim, review, and payout actions for you."}
        </div>
      ) : (
        <div className="action-center-list">
          {filteredItems.map((item) => {
            const discussionBounty = item.bounty;

            return (
              <article className={`action-center-card action-center-${item.tone}`} key={item.id}>
                <div className="action-center-top">
                  <span className="card-label">{item.eyebrow}</span>
                  <div className="inbox-card-tags">
                    <span className={`priority-badge priority-${item.priority}`}>{item.priority}</span>
                    <span className="trust-badge trust-neutral">{describeAudience(item)}</span>
                    <span className={`trust-badge trust-${item.tone}`}>{describeCategory(item)}</span>
                  </div>
                </div>

                <div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>

                <div className="inbox-meta-row">
                  <span>{item.meta}</span>
                  {item.deadlineLabel ? <span>{item.deadlineLabel}</span> : null}
                </div>

                <div className="card-actions">
                  <button className="button button-primary" onClick={() => onRunAction(item)} type="button">
                    {item.actionLabel}
                  </button>
                  {item.allowDiscussion && discussionBounty ? (
                    <button className="button button-ghost" onClick={() => onOpenDiscussion(discussionBounty)} type="button">
                      Open discussion
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
