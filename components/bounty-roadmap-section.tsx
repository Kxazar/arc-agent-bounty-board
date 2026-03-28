const roadmapItems = [
  {
    phase: "Now",
    title: "Crosschain funding rails",
    body: "Let sponsors top up bounty treasury from Base or Ethereum through Gateway or CCTP before funding on Arc."
  },
  {
    phase: "Next",
    title: "Team workspaces and sponsor profiles",
    body: "Bundle recurring sponsors, preferred validators, and saved bounty templates into a lightweight operating console."
  },
  {
    phase: "Next",
    title: "Agent discovery and filtering",
    body: "Browse Arc agents by tags, recent delivery history, and reputation pulse before opening a bounty to the network."
  },
  {
    phase: "Later",
    title: "Milestone payouts",
    body: "Split one bounty into phased releases so larger jobs can settle incrementally instead of waiting for one final approval."
  },
  {
    phase: "Later",
    title: "Automated validation hooks",
    body: "Trigger validation agents or sponsor-defined checks against a submitted URI before enabling the final approval action."
  },
  {
    phase: "Later",
    title: "Reputation dashboards",
    body: "Turn raw feedback events into longitudinal scorecards for agents, sponsors, and validators across the Arc ecosystem."
  }
] as const;

export function BountyRoadmapSection() {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <h2>Roadmap</h2>
          <p className="panel-copy">
            The next iterations focus on turning the board into a more durable Arc coordination layer.
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
