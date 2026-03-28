import type { Dispatch, SetStateAction } from "react";

import type { BountyView, CreateForm } from "@/components/bounty-board-types";

const claimWindowPresets = [
  { label: "24h", value: "24", unit: "hours" },
  { label: "7d", value: "7", unit: "days" },
  { label: "30d", value: "30", unit: "days" },
  { label: "4mo", value: "4", unit: "months" }
] as const;

interface BountyCreateStudioProps {
  createForm: CreateForm;
  editingBounty: BountyView | null;
  isSwitching: boolean;
  isWriting: boolean;
  setCreateForm: Dispatch<SetStateAction<CreateForm>>;
  onSubmit: () => void;
  onCancelEdit: () => void;
  variant?: "panel" | "flat";
}

export function BountyCreateStudio({
  createForm,
  editingBounty,
  isSwitching,
  isWriting,
  setCreateForm,
  onSubmit,
  onCancelEdit,
  variant = "panel"
}: BountyCreateStudioProps) {
  return (
    <div className={variant === "flat" ? "studio-flat" : "panel"} id="create-studio">
      <h2>Create bounty</h2>
      <p className="panel-copy">
        This form packages the title and summary into a JSON data URI, approves USDC if needed,
        and opens a new escrowed bounty on Arc.
      </p>

      {editingBounty ? (
        <div className="claim-callout claim-context">
          <strong>
            Editing bounty #{editingBounty.id.toString()} | {editingBounty.title}
          </strong>
          <span className="muted-line">
            Changes update the live bounty and refresh its claim window from the moment you save.
          </span>
        </div>
      ) : null}

      <label className="field">
        <span>Title</span>
        <input
          value={createForm.title}
          onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
        />
      </label>

      <label className="field">
        <span>Summary</span>
        <textarea
          rows={4}
          value={createForm.summary}
          onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Reward (USDC)</span>
          <input
            inputMode="decimal"
            value={createForm.reward}
            onChange={(event) => setCreateForm((current) => ({ ...current, reward: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>Contact</span>
          <input
            value={createForm.contact}
            onChange={(event) => setCreateForm((current) => ({ ...current, contact: event.target.value }))}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Claim window</span>
          <input
            inputMode="numeric"
            value={createForm.claimWindowValue}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, claimWindowValue: event.target.value }))
            }
          />
        </label>
        <label className="field">
          <span>Unit</span>
          <select
            value={createForm.claimWindowUnit}
            onChange={(event) =>
              setCreateForm((current) => ({
                ...current,
                claimWindowUnit: event.target.value as CreateForm["claimWindowUnit"]
              }))
            }
          >
            <option value="hours">Hours</option>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
          </select>
        </label>
        <label className="field">
          <span>Submission window</span>
          <input
            inputMode="numeric"
            value={createForm.submissionHours}
            onChange={(event) => setCreateForm((current) => ({ ...current, submissionHours: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>Review window</span>
          <input
            inputMode="numeric"
            value={createForm.reviewHours}
            onChange={(event) => setCreateForm((current) => ({ ...current, reviewHours: event.target.value }))}
          />
        </label>
      </div>

      <div className="mini-chip-row" aria-label="Claim window presets">
        {claimWindowPresets.map((preset) => {
          const isActive =
            createForm.claimWindowValue === preset.value && createForm.claimWindowUnit === preset.unit;

          return (
            <button
              className={`mini-chip ${isActive ? "mini-chip-active" : ""}`}
              key={preset.label}
              onClick={() =>
                setCreateForm((current) => ({
                  ...current,
                  claimWindowValue: preset.value,
                  claimWindowUnit: preset.unit
                }))
              }
              type="button"
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <p className="muted-line">
        Claim window now accepts any supplier-defined term, including longer discovery periods like 4 months.
      </p>

      <div className="card-actions">
        <button className="button button-primary" disabled={isWriting || isSwitching} onClick={onSubmit} type="button">
          {editingBounty ? "Save Bounty Changes" : "Create Escrowed Bounty"}
        </button>
        {editingBounty ? (
          <button className="button button-secondary" onClick={onCancelEdit} type="button">
            Cancel edit
          </button>
        ) : null}
      </div>
    </div>
  );
}
