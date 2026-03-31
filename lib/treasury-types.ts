export type TreasuryMode = "demo";

export type TreasuryStatus = "not_created" | "ready";

export type TreasurySourceChain = "Base Sepolia" | "Ethereum Sepolia";

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
  chainKey: "arc";
  chainLabel: "Arc Testnet";
  asset: "USDC";
  amount: string;
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
