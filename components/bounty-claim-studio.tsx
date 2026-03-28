import type { Dispatch, SetStateAction } from "react";

import { externalLinkProps } from "@/components/bounty-board-config";
import type { BountyView } from "@/components/bounty-board-types";
import { formatReputation, type OwnedAgent, type ReputationSummary } from "@/lib/agent-tools";
import { formatUsdc } from "@/lib/format";

interface ClaimFormValue {
  bountyId: string;
  agentId: string;
}

interface BountyClaimStudioProps {
  claimForm: ClaimFormValue;
  ownedAgents: OwnedAgent[];
  selectedAgent: OwnedAgent | null;
  selectedAgentReputation?: ReputationSummary;
  selectedBounty: BountyView | null;
  reputationByAgent: Record<string, ReputationSummary>;
  isLoadingAgents: boolean;
  isSwitching: boolean;
  isWriting: boolean;
  agentLookupError: string | null;
  setClaimForm: Dispatch<SetStateAction<ClaimFormValue>>;
  onSelectAgent: (agentId: bigint) => void;
  onClaim: () => void;
  variant?: "panel" | "flat";
}

export function BountyClaimStudio({
  claimForm,
  ownedAgents,
  selectedAgent,
  selectedAgentReputation,
  selectedBounty,
  reputationByAgent,
  isLoadingAgents,
  isSwitching,
  isWriting,
  agentLookupError,
  setClaimForm,
  onSelectAgent,
  onClaim,
  variant = "panel"
}: BountyClaimStudioProps) {
  return (
    <div className={variant === "flat" ? "studio-flat" : "panel"} id="claim-studio">
      <h2>Claim bounty</h2>
      <p className="panel-copy">
        Claim uses the real Arc ERC-8004 <code>agentId</code> and verifies wallet ownership
        through <code>ownerOf(agentId)</code> before sending the transaction.
      </p>

      <div className="agent-toolbar">
        <strong>Owned agents</strong>
        <span className="muted-line">
          {isLoadingAgents ? "Scanning recent registry activity..." : "Pick one for a faster claim."}
        </span>
      </div>

      <div className="agent-list">
        {ownedAgents.length > 0 ? (
          ownedAgents.map((agent) => (
            <button
              className={`agent-card ${claimForm.agentId === agent.agentId.toString() ? "agent-selected" : ""}`}
              key={agent.agentId.toString()}
              onClick={() => onSelectAgent(agent.agentId)}
              type="button"
            >
              <div className="agent-head">
                <span className="card-label">#{agent.agentId.toString()}</span>
                <span className="agent-score">
                  {formatReputation(reputationByAgent[agent.agentId.toString()])}
                </span>
              </div>
              <strong>{agent.name}</strong>
              <p>{agent.description}</p>
            </button>
          ))
        ) : (
          <div className="empty-inline">
            {agentLookupError ?? "No recent owned agents found yet."}
            <a {...externalLinkProps} href="https://docs.arc.network/arc/tutorials/register-your-first-ai-agent">
              Register one
            </a>
          </div>
        )}
      </div>

      {selectedAgent ? (
        <div className="claim-callout">
          <strong>
            Selected agent #{selectedAgent.agentId.toString()} | {selectedAgent.name}
          </strong>
          <span className="muted-line">Reputation pulse: {formatReputation(selectedAgentReputation)}</span>
        </div>
      ) : null}

      {selectedBounty ? (
        <div className="claim-callout claim-context">
          <strong>
            Ready to claim bounty #{selectedBounty.id.toString()} | {selectedBounty.title}
          </strong>
          <span className="muted-line">
            Reward: {formatUsdc(selectedBounty.payoutAmount)} | Contact: {selectedBounty.contact}
          </span>
        </div>
      ) : null}

      <div className="field-row">
        <label className="field">
          <span>Bounty ID</span>
          <input
            inputMode="numeric"
            value={claimForm.bountyId}
            onChange={(event) => setClaimForm((current) => ({ ...current, bountyId: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>Agent ID</span>
          <input
            inputMode="numeric"
            value={claimForm.agentId}
            onChange={(event) => setClaimForm((current) => ({ ...current, agentId: event.target.value }))}
          />
        </label>
      </div>

      <button
        className="button button-primary"
        disabled={isWriting || isSwitching || !claimForm.bountyId || !claimForm.agentId}
        onClick={onClaim}
        type="button"
      >
        Claim With Selected Agent
      </button>
    </div>
  );
}
