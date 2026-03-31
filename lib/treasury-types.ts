export type TreasuryMode = "demo" | "live";

export type TreasuryPersistenceBackend = "cookie" | "supabase";

export type TreasuryStatus = "not_created" | "ready";

export type TreasurySourceChain = "Base Sepolia" | "Ethereum Sepolia";

export type TreasuryChainKey = "arc" | "base-sepolia" | "ethereum-sepolia";

export type TreasuryEventStatus = "info" | "success" | "warning";

export type TreasuryEventKind =
  | "treasury_created"
  | "deposit_address_issued"
  | "deposit_received"
  | "bridge_started"
  | "bridge_completed"
  | "withdrawal_completed";

export type TreasuryFundingSessionStatus =
  | "address_issued"
  | "deposit_received"
  | "bridging"
  | "completed";

export type TreasuryBalance = {
  chainKey: TreasuryChainKey;
  chainLabel: string;
  asset: "USDC";
  amount: string;
  walletAddress?: string | null;
};

export type TreasuryEvent = {
  id: string;
  kind: TreasuryEventKind;
  status: TreasuryEventStatus;
  title: string;
  detail: string;
  createdAt: string;
};

export type TreasuryFundingSession = {
  id: string;
  sourceChain: TreasurySourceChain;
  targetChain: "Arc Testnet";
  amount: string;
  status: TreasuryFundingSessionStatus;
  depositAddress: string;
  createdAt: string;
  updatedAt: string;
};

export type TreasurySnapshot = {
  mode: TreasuryMode;
  persistenceBackend: TreasuryPersistenceBackend;
  ownerWallet: string;
  status: TreasuryStatus;
  circleWalletLabel: string | null;
  arcWalletAddress: string | null;
  availableArcUsdc: string;
  totalFundedUsdc: string;
  totalWithdrawnUsdc: string;
  depositAddress: string | null;
  lastSourceChain: TreasurySourceChain | null;
  balances: TreasuryBalance[];
  events: TreasuryEvent[];
  sessions: TreasuryFundingSession[];
};

export type TreasuryResponse = {
  snapshot: TreasurySnapshot;
};
