import { formatUsdcString, shortenAddress } from "@/lib/format";
import type { TreasurySnapshot } from "@/lib/treasury-types";
import type { Address } from "viem";

interface TreasuryWithdrawPanelProps {
  connectedAddress: Address | undefined;
  isBusy: boolean;
  snapshot: TreasurySnapshot;
  withdrawAmount: string;
  setWithdrawAmount: (value: string) => void;
  onWithdraw: () => void;
}

export function TreasuryWithdrawPanel({
  connectedAddress,
  isBusy,
  snapshot,
  withdrawAmount,
  setWithdrawAmount,
  onWithdraw
}: TreasuryWithdrawPanelProps) {
  const isLive = snapshot.mode === "live";

  return (
    <div className="panel">
      <h3>{isLive ? "Send Arc treasury funds to your wallet" : "Move Arc funds to your wallet"}</h3>
      <p className="panel-copy">
        {isLive
          ? "In live mode the Arc treasury wallet submits a real USDC transfer into your connected sponsor wallet, so the rest of the bounty flow can stay wallet-native."
          : "The current MVP keeps bounty creation wallet-native, so treasury funds are topped up into your connected Arc wallet before you create or edit tasks."}
      </p>

      <div className="claim-callout claim-context">
        <strong>Connected wallet</strong>
        <span className="muted-line">{shortenAddress(connectedAddress)}</span>
        <span className="muted-line">Available in treasury: {formatUsdcString(snapshot.availableArcUsdc)}</span>
      </div>

      <label className="field">
        <span>Wallet top-up amount (USDC)</span>
        <input
          inputMode="decimal"
          onChange={(event) => setWithdrawAmount(event.target.value)}
          value={withdrawAmount}
        />
      </label>

      <div className="card-actions">
        <button
          className="button button-primary"
          disabled={isBusy || snapshot.status !== "ready"}
          onClick={onWithdraw}
          type="button"
        >
          {isLive ? "Send treasury funds" : "Move funds to wallet"}
        </button>
      </div>
    </div>
  );
}
