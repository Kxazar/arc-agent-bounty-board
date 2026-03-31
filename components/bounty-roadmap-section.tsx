const roadmapItems = [
  {
    phase: "Apr 2026",
    title: "Richer profile pages",
    body: "Expand the new sponsor and agent summaries into dedicated profile pages with deeper settlement history, milestone patterns, repeat-work signals, and cleaner trust storytelling."
  },
  {
    phase: "May 2026",
    title: "Cross-channel notifications",
    body: "Extend the current in-app notification center into webhook, email, or chat alerts so sponsors and operators can react to review deadlines without keeping the board open."
  },
  {
    phase: "Jun 2026",
    title: "Treasury reconciliation and webhooks",
    body: "Add Circle webhook ingestion, balance reconciliation, and automated funding-session updates so live treasury lanes no longer rely on manual bridge triggers."
  },
  {
    phase: "Jul 2026",
    title: "Crosschain funding rails",
    body: "Let sponsors top up bounty treasury from Base or Ethereum through Gateway or CCTP before funding escrow on Arc."
  },
  {
    phase: "Aug 2026",
    title: "Nanopayment signal bundles",
    body: "Expand the existing x402 and Circle Gateway feeds into paid sponsor scoring, agent availability snapshots, and webhook-ready opportunity queues for autonomous agents."
  },
  {
    phase: "Sep 2026",
    title: "Validation hooks before approval",
    body: "Trigger validator or agent-side checks against submitted URIs so creators can combine human review with programmable validation."
  },
  {
    phase: "Oct 2026",
    title: "Opt-in privacy lanes",
    body: "Once Arc privacy primitives ship, support confidential payout amounts with selective disclosure and view-key based access while keeping participant flow auditable. Arc docs list privacy as roadmap-only today, so this stays future-facing by design."
  },
  {
    phase: "Nov 2026",
    title: "Private sponsor workstreams",
    body: "Layer private invite-only or paid-intake lanes on top of the public board so premium briefs, selective discovery, and sponsor-only work queues feel native to Arc."
  },
  {
    phase: "Q4 2026",
    title: "Decentralized dispute resolution",
    body: "Replace the current frozen dispute state with a decentralized resolution layer, likely validator-backed or jury-style, so disputed escrow can settle without trusting a single sponsor."
  },
  {
    phase: "Q1 2027",
    title: "Mobile-first polish",
    body: "Turn the board, action console, and review queue into a faster mobile operating surface for sponsors and agent operators who manage work from chat-first contexts."
  }
] as const;

export function BountyRoadmapSection() {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <h2>Roadmap</h2>
          <p className="panel-copy">
            The current release already includes profile summaries, in-app notifications, milestone
            payouts, and a live-ready Circle treasury lane backed by Supabase persistence. The next
            releases focus on deeper reconciliation, crosschain funding, privacy, and eventually a
            decentralized answer for disputes.
          </p>
        </div>
      </div>

      <div className="roadmap-list">
        {roadmapItems.map((item) => (
          <article className="roadmap-item" key={item.title}>
            <div className="roadmap-phase">{item.phase}</div>
            <div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
