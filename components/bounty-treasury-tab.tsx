import type { Address } from "viem";

import { TreasuryBalanceCard } from "@/components/treasury-balance-card";
import { TreasuryEventsFeed } from "@/components/treasury-events-feed";
import { TreasuryFundingPanel } from "@/components/treasury-funding-panel";
import { TreasuryWithdrawPanel } from "@/components/treasury-withdraw-panel";
import type { TreasurySnapshot, TreasurySourceChain } from "@/lib/treasury-types";

interface BountyTreasuryTabProps {
  connectedAddress: Address | undefined;
  error: string | null;
  isConnected: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  latestSessionId: string | null;
  notice: string | null;
  snapshot: TreasurySnapshot | null;
  sourceChain: TreasurySourceChain;
  depositAmount: string;
  withdrawAmount: string;
  setSourceChain: (value: TreasurySourceChain) => void;
  setDepositAmount: (value: string) => void;
  setWithdrawAmount: (value: string) => void;
  onCreateTreasury: () => void;
  onIssueDepositAddress: () => void;
  onSimulateBridge: (sessionId: string) => void;
  onWithdraw: () => void;
  onRefresh: () => void;
}

export function BountyTreasuryTab({
  connectedAddress,
  error,
  isConnected,
  isLoading,
  isSubmitting,
  latestSessionId,
  notice,
  snapshot,
  sourceChain,
  depositAmount,
  withdrawAmount,
  setSourceChain,
  setDepositAmount,
  setWithdrawAmount,
  onCreateTreasury,
  onIssueDepositAddress,
  onSimulateBridge,
  onWithdraw,
  onRefresh
}: BountyTreasuryTabProps) {
  if (!isConnected || !connectedAddress || !snapshot) {
    return (
      <section className="panel board-panel">
        <h2>Treasury</h2>
        <p className="panel-copy">
          Connect a wallet to open the sponsor treasury lane. This is where cross-chain funding and Arc balance prep will live.
        </p>
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="section-header">
        <div>
          <h2>Treasury</h2>
          <p className="panel-copy">
            {snapshot.mode === "live"
              ? "A live Circle-backed treasury lane for managed sponsor wallets, Bridge Kit routing into Arc, and persisted funding history in Supabase."
              : "A compact Arc Fintech-inspired funding lane for sponsor treasury creation, bridging into Arc, and topping up your connected wallet for the existing bounty flow."}
          </p>
        </div>
        <div className="section-actions">
          <button className="button button-secondary" disabled={isLoading || isSubmitting} onClick={onRefresh} type="button">
            Refresh treasury
          </button>
        </div>
      </div>

      {notice ? <div className="toast treasury-inline-info">{notice}</div> : null}
      {error ? <div className="toast treasury-inline-error">{error}</div> : null}

      <TreasuryBalanceCard snapshot={snapshot} />

      <div className="grid-two">
        <TreasuryFundingPanel
          depositAmount={depositAmount}
          isBusy={isLoading || isSubmitting}
          latestSessionId={latestSessionId}
          snapshot={snapshot}
          sourceChain={sourceChain}
          setDepositAmount={setDepositAmount}
          setSourceChain={setSourceChain}
          onCreateTreasury={onCreateTreasury}
          onIssueDepositAddress={onIssueDepositAddress}
          onSimulateBridge={onSimulateBridge}
        />

        <TreasuryWithdrawPanel
          connectedAddress={connectedAddress}
          isBusy={isLoading || isSubmitting}
          snapshot={snapshot}
          withdrawAmount={withdrawAmount}
          setWithdrawAmount={setWithdrawAmount}
          onWithdraw={onWithdraw}
        />
      </div>

      <TreasuryEventsFeed snapshot={snapshot} />
    </section>
  );
}
