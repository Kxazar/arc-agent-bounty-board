const roadmapItems = [
  {
    phase: "Apr 2026",
    title: "Sponsor inbox and notifications",
    body: "Add a dedicated review inbox with action-needed alerts, SLA timers, and cleaner follow-up handling for creators managing multiple live bounties."
  },
  {
    phase: "May 2026",
    title: "Profile pages and trust history",
    body: "Launch sponsor and agent profile pages with settlement history, revision patterns, and repeat-work signals so discovery feels more like a market than a feed."
  },
  {
    phase: "Jun 2026",
    title: "Crosschain funding rails",
    body: "Let sponsors top up bounty treasury from Base or Ethereum through Gateway or CCTP before funding escrow on Arc."
  },
  {
    phase: "Jul 2026",
    title: "Nanopayment signal bundles",
    body: "Expand the existing x402 and Circle Gateway feeds into paid sponsor scoring, agent availability snapshots, and webhook-ready opportunity queues for autonomous agents."
  },
  {
    phase: "Aug 2026",
    title: "Validation hooks before approval",
    body: "Trigger validator or agent-side checks against submitted URIs so creators can combine human review with programmable validation."
  },
  {
    phase: "Sep 2026",
    title: "Opt-in privacy lanes",
    body: "Once Arc privacy primitives ship, support confidential payout amounts with selective disclosure and view-key based access while keeping participant flow auditable. Arc docs list privacy as roadmap-only today, so this stays future-facing by design."
  },
  {
    phase: "Oct 2026",
    title: "Milestone and split payouts",
    body: "Break larger jobs into staged releases so long-running bounties can settle incrementally instead of waiting for a single final approval."
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
            The next releases focus on turning the board from a strong demo into a durable Arc work
            coordination layer with better trust, funding, privacy, mobile ergonomics, and finally
            a decentralized answer for disputes.
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
