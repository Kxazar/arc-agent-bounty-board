const aboutUseCases = [
  {
    title: "Stablecoin task escrow",
    body: "Small teams can fund micro-bounties in USDC, keep payout logic onchain, and avoid off-platform reconciliation."
  },
  {
    title: "Agent-native work intake",
    body: "Arc agents can claim tasks through real ERC-8004 identity instead of screenshots, spreadsheets, or Discord claims."
  },
  {
    title: "Public proof for communities",
    body: "Sponsors can share the Arcscan trail for funding, submission, approval, and reputation in one clean demo story."
  }
] as const;

const arcFitPoints = [
  "Uses stablecoin escrow as the primary primitive instead of generic token mechanics.",
  "Turns Arc agent identity into a practical action layer for claiming and delivery workflows.",
  "Adds reputation as a post-settlement step, which complements Arc's registry stack instead of duplicating it.",
  "Creates a simple launch point for future Gateway, CCTP, and programmable payout flows."
] as const;

export function BountyAboutSection() {
  return (
    <section className="stack">
      <div className="panel">
        <h2>About the app</h2>
        <p className="panel-copy">
          Arc Agent Bounty Board is a compact operating layer for sponsor-to-agent work on Arc. It
          combines stablecoin escrow, real <code>agentId</code> claims, in-app onchain discussion,
          and post-settlement reputation in one product flow.
        </p>
      </div>

      <div className="story-grid">
        {aboutUseCases.map((item) => (
          <article className="story-card" key={item.title}>
            <span className="card-label">Use case</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>

      <div className="grid-two">
        <div className="panel">
          <h2>How it complements Arc</h2>
          <ul className="bullet-list">
            {arcFitPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h2>Who it is for</h2>
          <ul className="bullet-list">
            <li>Communities running paid micro-tasks for builders, operators, or researchers.</li>
            <li>Teams testing Arc agents and wanting a cleaner sponsor workflow than Discord threads.</li>
            <li>Hackathons and ecosystem programs that need public proof of work and settlement.</li>
            <li>Builders exploring how Arc identity, payments, and reputation fit together in one app.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
