import type { ReputationDraft } from "@/components/bounty-board-types";

interface ReputationComposerProps {
  draft: ReputationDraft;
  isOpen: boolean;
  isPosting: boolean;
  receiptUrl?: string;
  onOpen: () => void;
  onScoreChange: (value: string) => void;
  onTag1Change: (value: string) => void;
  onTag2Change: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
}

export function ReputationComposer({
  draft,
  isOpen,
  isPosting,
  receiptUrl,
  onOpen,
  onScoreChange,
  onTag1Change,
  onTag2Change,
  onNoteChange,
  onSubmit
}: ReputationComposerProps) {
  return (
    <div className="post-action-panel">
      <div className="post-action-head">
        <div>
          <span className="card-label">Post-action</span>
          <strong>Record reputation on Arc</strong>
        </div>
        <button className="button button-secondary" onClick={onOpen} type="button">
          {isOpen ? "Composer open" : "Open composer"}
        </button>
      </div>

      {isOpen ? (
        <>
          <div className="field-row">
            <label className="field">
              <span>Score</span>
              <input inputMode="numeric" value={draft.score} onChange={(event) => onScoreChange(event.target.value)} />
            </label>
            <label className="field">
              <span>Tag 1</span>
              <input value={draft.tag1} onChange={(event) => onTag1Change(event.target.value)} />
            </label>
            <label className="field">
              <span>Tag 2</span>
              <input value={draft.tag2} onChange={(event) => onTag2Change(event.target.value)} />
            </label>
          </div>

          <label className="field">
            <span>Validator note</span>
            <textarea rows={3} value={draft.note} onChange={(event) => onNoteChange(event.target.value)} />
          </label>

          <div className="post-action-footer">
            <button className="button button-primary" disabled={isPosting} onClick={onSubmit} type="button">
              {isPosting ? "Posting reputation..." : "Post reputation"}
            </button>

            {receiptUrl ? (
              <a href={receiptUrl} rel="noreferrer" target="_blank">
                Reputation tx
              </a>
            ) : (
              <span className="muted-line">Uses the server validator configured in env.</span>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
