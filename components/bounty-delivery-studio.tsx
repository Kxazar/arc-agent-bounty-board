import type { Dispatch, SetStateAction } from "react";
import { zeroAddress } from "viem";

import type { BountyView } from "@/components/bounty-board-types";
import { shortenAddress } from "@/lib/format";

interface ResultFormValue {
  bountyId: string;
  resultURI: string;
}

interface BountyDeliveryStudioProps {
  resultForm: ResultFormValue;
  preparedResultBounty: BountyView | null;
  isSwitching: boolean;
  isWriting: boolean;
  setResultForm: Dispatch<SetStateAction<ResultFormValue>>;
  onSubmit: () => void;
}

export function BountyDeliveryStudio({
  resultForm,
  preparedResultBounty,
  isSwitching,
  isWriting,
  setResultForm,
  onSubmit
}: BountyDeliveryStudioProps) {
  return (
    <div className="panel" id="delivery-studio">
      <h2>Delivery queue</h2>
      <p className="panel-copy">
        After claim, submit the result URI here. The queue stays available as a compact follow-up
        workspace while create and claim now live in the top action console.
      </p>

      {preparedResultBounty ? (
        <div className="claim-callout delivery-callout">
          <strong>
            Delivery target #{preparedResultBounty.id.toString()} | {preparedResultBounty.title}
          </strong>
          <span className="muted-line">
            Milestone{" "}
            {Math.min(preparedResultBounty.releasedMilestones + 1, preparedResultBounty.milestoneCount)}{" "}
            of {preparedResultBounty.milestoneCount} |{" "}
            Claimant:{" "}
            {preparedResultBounty.claimant === zeroAddress
              ? "Awaiting claim"
              : shortenAddress(preparedResultBounty.claimant)}
          </span>
        </div>
      ) : null}

      <div className="field-row">
        <label className="field">
          <span>Bounty ID</span>
          <input
            inputMode="numeric"
            value={resultForm.bountyId}
            onChange={(event) => setResultForm((current) => ({ ...current, bountyId: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>Result URI</span>
          <input
            value={resultForm.resultURI}
            onChange={(event) => setResultForm((current) => ({ ...current, resultURI: event.target.value }))}
          />
        </label>
      </div>

      <button className="button button-secondary" disabled={isWriting || isSwitching} onClick={onSubmit} type="button">
        Submit Deliverable
      </button>

      <div className="mini-timeline">
        <div>
          <span>1</span>
          Claim bounty
        </div>
        <div>
          <span>2</span>
          Submit result
        </div>
        <div>
          <span>3</span>
          Approve and post reputation
        </div>
      </div>
    </div>
  );
}
