interface BountyBoardReadinessProps {
  hasBountyBoardAddress: boolean;
  isConnected: boolean;
  isOnArc: boolean;
  ownedAgentCount: number;
  selectedAgentLabel?: string;
}

export function BountyBoardReadiness({
  hasBountyBoardAddress,
  isConnected,
  isOnArc,
  ownedAgentCount,
  selectedAgentLabel
}: BountyBoardReadinessProps) {
  const readinessItems = [
    {
      label: "Wallet connected",
      ready: isConnected,
      detail: isConnected ? "Your sponsor or agent wallet is live in the session." : "Connect a wallet to fund, claim, and settle."
    },
    {
      label: "Arc network ready",
      ready: isConnected && isOnArc,
      detail: isConnected
        ? isOnArc
          ? "You are already on Arc Testnet."
          : "Switch to Arc Testnet before sending any transactions."
        : "Network checks unlock after wallet connection."
    },
    {
      label: "Board deployment live",
      ready: hasBountyBoardAddress,
      detail: hasBountyBoardAddress
        ? "The UI is wired to a deployed ArcBountyBoard contract."
        : "Add the deployed contract address to the frontend config."
    },
    {
      label: "Agent ready to claim",
      ready: ownedAgentCount > 0,
      detail:
        ownedAgentCount > 0
          ? selectedAgentLabel
            ? `Selected ${selectedAgentLabel} for quick-claim flows.`
            : `${ownedAgentCount} owned agent${ownedAgentCount === 1 ? "" : "s"} found. Pick one in Claim Studio.`
          : "Register or connect an Arc agent identity before claiming work."
    }
  ];

  const completedCount = readinessItems.filter((item) => item.ready).length;
  const nextStep =
    readinessItems.find((item) => !item.ready) ?? {
      label: "Run the demo",
      detail: "Everything is ready. Pick a seeded bounty, claim it, submit the result, and settle reputation."
    };

  return (
    <section className="panel board-panel">
      <div className="section-header">
        <div>
          <h2>Readiness check</h2>
          <p className="panel-copy">
            This keeps the demo self-explanatory before the user even touches the studios.
          </p>
        </div>
        <span className={`readiness-badge ${completedCount === readinessItems.length ? "readiness-badge-ready" : ""}`}>
          {completedCount}/{readinessItems.length} ready
        </span>
      </div>

      <div className="readiness-grid">
        {readinessItems.map((item) => (
          <article className={`readiness-card ${item.ready ? "readiness-card-ready" : "readiness-card-pending"}`} key={item.label}>
            <div className="readiness-head">
              <span className={`readiness-dot ${item.ready ? "readiness-dot-ready" : "readiness-dot-pending"}`} />
              <strong>{item.label}</strong>
            </div>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="claim-callout">
        <span className="card-label">Next setup step</span>
        <strong>{nextStep.label}</strong>
        <p>{nextStep.detail}</p>
      </div>
    </section>
  );
}
