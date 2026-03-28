import type { BountyView, ReviewDraft } from "@/components/bounty-board-types";

interface BountyReviewPanelProps {
  bounty: BountyView;
  draft: ReviewDraft;
  isOpen: boolean;
  isCreator: boolean;
  isClaimant: boolean;
  isWriting: boolean;
  onOpen: () => void;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onOpenDispute: () => void;
}

function getPanelConfig(bounty: BountyView, isCreator: boolean, isClaimant: boolean) {
  if (isCreator && bounty.status === 2) {
    return {
      triggerLabel: "Open review",
      title: "Sponsor review",
      body: "Pass the delivery, send it back for revision, or freeze the bounty into dispute if neutral resolution is needed.",
      noteLabel: "Review note"
    };
  }

  if (isClaimant && (bounty.status === 2 || bounty.status === 3)) {
    return {
      triggerLabel: "Open response",
      title: "Escalate to dispute",
      body: "If the sponsor review is unfair or the revision request is not aligned with the agreed scope, freeze the bounty and attach a dispute note.",
      noteLabel: "Dispute note"
    };
  }

  return null;
}

export function BountyReviewPanel({
  bounty,
  draft,
  isOpen,
  isCreator,
  isClaimant,
  isWriting,
  onOpen,
  onNoteChange,
  onApprove,
  onRequestChanges,
  onOpenDispute
}: BountyReviewPanelProps) {
  const config = getPanelConfig(bounty, isCreator, isClaimant);

  if (!config) {
    return null;
  }

  const showCreatorActions = isCreator && bounty.status === 2;

  if (!isOpen) {
    return (
      <div className="review-entry">
        <button className="button button-secondary" onClick={onOpen} type="button">
          {config.triggerLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="review-panel">
      <div className="post-action-head">
        <div>
          <span className="card-label">Review gate</span>
          <h3>{config.title}</h3>
          <p>{config.body}</p>
        </div>
      </div>

      <label className="field">
        <span>{config.noteLabel}</span>
        <textarea
          rows={4}
          value={draft.note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </label>

      <div className="card-actions">
        {showCreatorActions ? (
          <>
            <button className="button button-primary" disabled={isWriting} onClick={onApprove} type="button">
              Pass review and release
            </button>
            <button className="button button-secondary" disabled={isWriting} onClick={onRequestChanges} type="button">
              Request changes
            </button>
          </>
        ) : null}

        <button className="button button-ghost" disabled={isWriting} onClick={onOpenDispute} type="button">
          Open dispute
        </button>
      </div>
    </div>
  );
}
