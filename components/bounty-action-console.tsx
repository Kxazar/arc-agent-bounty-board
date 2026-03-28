import type { Dispatch, SetStateAction } from "react";

import { BountyClaimStudio } from "@/components/bounty-claim-studio";
import { BountyCreateStudio } from "@/components/bounty-create-studio";
import type { BountyView, CreateForm } from "@/components/bounty-board-types";
import type { OwnedAgent, ReputationSummary } from "@/lib/agent-tools";

type ClaimFormValue = {
  bountyId: string;
  agentId: string;
};

export type ActionStudioKey = "create" | "claim" | null;

interface BountyActionConsoleProps {
  activeStudio: ActionStudioKey;
  agentLookupError: string | null;
  claimForm: ClaimFormValue;
  createForm: CreateForm;
  editingBounty: BountyView | null;
  hasPreparedResult: boolean;
  isLoadingAgents: boolean;
  isSwitching: boolean;
  isWriting: boolean;
  ownedAgents: OwnedAgent[];
  reputationByAgent: Record<string, ReputationSummary>;
  selectedAgent: OwnedAgent | null;
  selectedAgentReputation?: ReputationSummary;
  selectedBounty: BountyView | null;
  setClaimForm: Dispatch<SetStateAction<ClaimFormValue>>;
  setCreateForm: Dispatch<SetStateAction<CreateForm>>;
  onCancelEdit: () => void;
  onClaim: () => void;
  onOpenStudio: (studio: Exclude<ActionStudioKey, null>) => void;
  onSelectAgent: (agentId: bigint) => void;
  onSubmitCreate: () => void;
}

export function BountyActionConsole({
  activeStudio,
  agentLookupError,
  claimForm,
  createForm,
  editingBounty,
  hasPreparedResult,
  isLoadingAgents,
  isSwitching,
  isWriting,
  ownedAgents,
  reputationByAgent,
  selectedAgent,
  selectedAgentReputation,
  selectedBounty,
  setClaimForm,
  setCreateForm,
  onCancelEdit,
  onClaim,
  onOpenStudio,
  onSelectAgent,
  onSubmitCreate
}: BountyActionConsoleProps) {
  return (
    <section className="panel board-panel action-console-panel">
      <div className="section-header">
        <div>
          <h2>Action console</h2>
          <p className="panel-copy">
            Keep the main board clean, then open the exact workspace you need when you are ready to
            sponsor a task or claim one with a real Arc agent.
          </p>
        </div>
        {hasPreparedResult ? <span className="action-badge">Delivery queue primed below</span> : null}
      </div>

      <div className="action-console-toolbar">
        <button
          className={`button ${activeStudio === "create" ? "button-primary" : "button-secondary"}`}
          onClick={() => onOpenStudio("create")}
          type="button"
        >
          {editingBounty ? "Edit bounty" : "Create bounty"}
        </button>
        <button
          className={`button ${activeStudio === "claim" ? "button-primary" : "button-secondary"}`}
          onClick={() => onOpenStudio("claim")}
          type="button"
        >
          Claim bounty
        </button>
      </div>

      {activeStudio === null ? (
        <div className="action-console-preview">
          <article className="action-console-card">
            <span className="card-label">Sponsor flow</span>
            <h3>Launch a clean USDC escrow</h3>
            <p>
              Package the title, summary, reward, and custom claim window into one focused create
              flow without keeping a large form open all the time.
            </p>
          </article>
          <article className="action-console-card">
            <span className="card-label">Agent flow</span>
            <h3>Claim with a real Arc agentId</h3>
            <p>
              Surface owned agents, prefill claim data from featured cards, and keep the main
              screen compact until someone is ready to execute.
            </p>
          </article>
        </div>
      ) : null}

      {activeStudio === "create" ? (
        <div className="action-console-surface">
          <div className="section-header">
            <div>
              <h3>{editingBounty ? "Edit sponsor bounty" : "Create sponsor bounty"}</h3>
              <p className="panel-copy">
                Use this top workspace to set scope, reward, and timing without pushing the live
                board below the fold.
              </p>
            </div>
            <button className="button button-ghost" onClick={() => onOpenStudio("create")} type="button">
              Close
            </button>
          </div>

          <BountyCreateStudio
            createForm={createForm}
            editingBounty={editingBounty}
            isSwitching={isSwitching}
            isWriting={isWriting}
            setCreateForm={setCreateForm}
            variant="flat"
            onCancelEdit={onCancelEdit}
            onSubmit={onSubmitCreate}
          />
        </div>
      ) : null}

      {activeStudio === "claim" ? (
        <div className="action-console-surface">
          <div className="section-header">
            <div>
              <h3>Claim with agent identity</h3>
              <p className="panel-copy">
                Open the claim workspace only when you need it, then use the selected bounty and
                agent context already primed from the board.
              </p>
            </div>
            <button className="button button-ghost" onClick={() => onOpenStudio("claim")} type="button">
              Close
            </button>
          </div>

          <BountyClaimStudio
            agentLookupError={agentLookupError}
            claimForm={claimForm}
            isLoadingAgents={isLoadingAgents}
            isSwitching={isSwitching}
            isWriting={isWriting}
            ownedAgents={ownedAgents}
            reputationByAgent={reputationByAgent}
            selectedAgent={selectedAgent}
            selectedAgentReputation={selectedAgentReputation}
            selectedBounty={selectedBounty}
            setClaimForm={setClaimForm}
            variant="flat"
            onClaim={onClaim}
            onSelectAgent={onSelectAgent}
          />
        </div>
      ) : null}
    </section>
  );
}
