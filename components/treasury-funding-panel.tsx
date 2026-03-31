import type { TreasurySourceChain, TreasurySnapshot } from "@/lib/treasury-types";

interface TreasuryFundingPanelProps {
  depositAmount: string;
  isBusy: boolean;
  latestSessionId: string | null;
  snapshot: TreasurySnapshot;
  sourceChain: TreasurySourceChain;
  setDepositAmount: (value: string) => void;
  setSourceChain: (value: TreasurySourceChain) => void;
  onCreateTreasury: () => void;
  onIssueDepositAddress: () => void;
  onSimulateBridge: (sessionId: string) => void;
}

export function TreasuryFundingPanel({
  depositAmount,
  isBusy,
  latestSessionId,
  snapshot,
  sourceChain,
  setDepositAmount,
  setSourceChain,
  onCreateTreasury,
  onIssueDepositAddress,
  onSimulateBridge
}: TreasuryFundingPanelProps) {
  return (
    <div className="panel">
      <h3>Sponsor funding lane</h3>
      <p className="panel-copy">
        Mirror the Arc Fintech flow: create a sponsor treasury, issue a deposit address, and move USDC into Arc through a simulated bridge.
      </p>

      {snapshot.status !== "ready" ? (
        <div className="post-action-panel">
          <strong>Create the sponsor treasury first</strong>
          <p>Once created, the app will issue deposit addresses and track bridge-ready funding sessions for this wallet.</p>
          <button className="button button-primary" disabled={isBusy} onClick={onCreateTreasury} type="button">
            Create treasury
          </button>
        </div>
      ) : (
        <>
          <div className="field-row">
            <label className="field">
              <span>Source chain</span>
              <select
                onChange={(event) => setSourceChain(event.target.value as TreasurySourceChain)}
                value={sourceChain}
              >
                <option value="Base Sepolia">Base Sepolia</option>
                <option value="Ethereum Sepolia">Ethereum Sepolia</option>
              </select>
            </label>
            <label className="field">
              <span>Planned deposit (USDC)</span>
              <input
                inputMode="decimal"
                onChange={(event) => setDepositAmount(event.target.value)}
                value={depositAmount}
              />
            </label>
          </div>

          <div className="card-actions">
            <button className="button button-primary" disabled={isBusy} onClick={onIssueDepositAddress} type="button">
              Issue deposit address
            </button>
            {latestSessionId ? (
              <button
                className="button button-secondary"
                disabled={isBusy}
                onClick={() => onSimulateBridge(latestSessionId)}
                type="button"
              >
                Simulate deposit + bridge
              </button>
            ) : null}
          </div>

          {snapshot.depositAddress ? (
            <div className="claim-callout claim-context">
              <strong>Latest deposit address</strong>
              <span className="muted-line">{snapshot.depositAddress}</span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
