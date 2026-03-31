import "server-only";

import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";
import { BridgeChain, BridgeKit } from "@circle-fin/bridge-kit";
import {
  initiateDeveloperControlledWalletsClient,
  type CircleDeveloperControlledWalletsClient
} from "@circle-fin/developer-controlled-wallets";

import { ARC_CONTRACTS } from "@/lib/arc";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { getTreasuryEnvironment } from "@/lib/treasury-env";
import {
  ARC_TREASURY_CHAIN,
  MAX_EVENTS,
  MAX_SESSIONS,
  SOURCE_CHAIN_CONFIG,
  addUsdc,
  assertWallet,
  buildArcBalance,
  buildBalance,
  clampRecent,
  createEmptySnapshot,
  normalizeWallet,
  parseUsdcAmount,
  sanitizeForJson,
  subtractUsdc
} from "@/lib/treasury-shared";
import type {
  TreasuryBalance,
  TreasuryEvent,
  TreasuryFundingSession,
  TreasuryResponse,
  TreasurySnapshot,
  TreasurySourceChain
} from "@/lib/treasury-types";

type SponsorTreasuryRow = {
  owner_wallet: string;
  status: "not_created" | "ready";
  circle_wallet_label: string | null;
  circle_wallet_set_id: string | null;
  arc_wallet_id: string | null;
  arc_wallet_address: string | null;
  base_wallet_id: string | null;
  base_wallet_address: string | null;
  ethereum_wallet_id: string | null;
  ethereum_wallet_address: string | null;
  total_funded_usdc: string;
  total_withdrawn_usdc: string;
  created_at: string;
  updated_at: string;
};

type TreasuryBalanceRow = {
  owner_wallet: string;
  chain_key: TreasuryBalance["chainKey"];
  chain_label: string;
  asset: "USDC";
  amount: string;
  wallet_address: string | null;
  updated_at: string;
};

type TreasuryFundingSessionRow = {
  id: string;
  owner_wallet: string;
  source_chain: TreasurySourceChain;
  target_chain: "Arc Testnet";
  amount: string;
  status: TreasuryFundingSession["status"];
  deposit_address: string;
  route_estimate: unknown | null;
  bridge_result: unknown | null;
  created_at: string;
  updated_at: string;
};

type TreasuryEventRow = {
  id: string;
  owner_wallet: string;
  kind: TreasuryEvent["kind"];
  status: TreasuryEvent["status"];
  title: string;
  detail: string;
  metadata: unknown | null;
  created_at: string;
};

let bridgeKit: BridgeKit | null = null;
let circleWalletsAdapter: ReturnType<typeof createCircleWalletsAdapter> | null = null;
let developerControlledWalletsClient: CircleDeveloperControlledWalletsClient | null = null;

function getBridgeKit() {
  if (!bridgeKit) {
    bridgeKit = new BridgeKit();
  }

  return bridgeKit;
}

function getCircleWalletsAdapter() {
  const environment = getTreasuryEnvironment();

  if (!environment.hasCircleWallets) {
    throw new Error("Circle DCW credentials are missing. Add CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET.");
  }

  if (!circleWalletsAdapter) {
    circleWalletsAdapter = createCircleWalletsAdapter({
      apiKey: environment.circleApiKey,
      entitySecret: environment.circleEntitySecret,
      baseUrl: environment.circleApiBaseUrl
    });
  }

  return circleWalletsAdapter;
}

function getDeveloperControlledWalletsClient() {
  const environment = getTreasuryEnvironment();

  if (!environment.hasCircleWallets) {
    throw new Error("Circle DCW credentials are missing. Add CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET.");
  }

  if (!developerControlledWalletsClient) {
    developerControlledWalletsClient = initiateDeveloperControlledWalletsClient({
      apiKey: environment.circleApiKey,
      entitySecret: environment.circleEntitySecret,
      baseUrl: environment.circleApiBaseUrl
    });
  }

  return developerControlledWalletsClient;
}

function nowIso() {
  return new Date().toISOString();
}

function createDbEvent(input: Omit<TreasuryEventRow, "id" | "created_at">): TreasuryEventRow {
  return {
    id: crypto.randomUUID(),
    created_at: nowIso(),
    ...input
  };
}

function getBaseBalances(row: SponsorTreasuryRow | null) {
  return [
    buildArcBalance("0", row?.arc_wallet_address ?? null),
    buildBalance({
      chainKey: SOURCE_CHAIN_CONFIG["Base Sepolia"].chainKey,
      chainLabel: SOURCE_CHAIN_CONFIG["Base Sepolia"].chainLabel,
      amount: "0",
      walletAddress: row?.base_wallet_address ?? null
    }),
    buildBalance({
      chainKey: SOURCE_CHAIN_CONFIG["Ethereum Sepolia"].chainKey,
      chainLabel: SOURCE_CHAIN_CONFIG["Ethereum Sepolia"].chainLabel,
      amount: "0",
      walletAddress: row?.ethereum_wallet_address ?? null
    })
  ];
}

function mapBalanceRows(row: SponsorTreasuryRow | null, balanceRows: TreasuryBalanceRow[] | null) {
  const baseBalances = getBaseBalances(row);

  if (!balanceRows?.length) {
    return baseBalances;
  }

  const byChainKey = new Map(
    balanceRows.map((item) => [
      item.chain_key,
      buildBalance({
        chainKey: item.chain_key,
        chainLabel: item.chain_label,
        amount: item.amount,
        walletAddress: item.wallet_address
      })
    ])
  );

  return baseBalances.map((item) => byChainKey.get(item.chainKey) ?? item);
}

function mapSessionRows(rows: TreasuryFundingSessionRow[] | null): TreasuryFundingSession[] {
  return (rows ?? []).map((item) => ({
    id: item.id,
    sourceChain: item.source_chain,
    targetChain: item.target_chain,
    amount: item.amount,
    status: item.status,
    depositAddress: item.deposit_address,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }));
}

function mapEventRows(rows: TreasuryEventRow[] | null): TreasuryEvent[] {
  return (rows ?? []).map((item) => ({
    id: item.id,
    kind: item.kind,
    status: item.status,
    title: item.title,
    detail: item.detail,
    createdAt: item.created_at
  }));
}

function buildLiveSnapshot(params: {
  ownerWallet: string;
  treasuryRow: SponsorTreasuryRow | null;
  balanceRows: TreasuryBalanceRow[] | null;
  sessionRows: TreasuryFundingSessionRow[] | null;
  eventRows: TreasuryEventRow[] | null;
}): TreasurySnapshot {
  const { ownerWallet, treasuryRow, balanceRows, sessionRows, eventRows } = params;

  if (!treasuryRow) {
    return createEmptySnapshot({
      mode: "live",
      ownerWallet,
      persistenceBackend: "supabase"
    });
  }

  const balances = mapBalanceRows(treasuryRow, balanceRows);
  const sessions = clampRecent(mapSessionRows(sessionRows), MAX_SESSIONS);
  const events = clampRecent(mapEventRows(eventRows), MAX_EVENTS);
  const latestSession = sessions[0] ?? null;
  const arcBalance = balances.find((item) => item.chainKey === "arc")?.amount ?? "0";

  return {
    mode: "live",
    persistenceBackend: "supabase",
    ownerWallet: treasuryRow.owner_wallet,
    status: treasuryRow.status,
    circleWalletLabel: treasuryRow.circle_wallet_label,
    arcWalletAddress: treasuryRow.arc_wallet_address,
    availableArcUsdc: arcBalance,
    totalFundedUsdc: treasuryRow.total_funded_usdc,
    totalWithdrawnUsdc: treasuryRow.total_withdrawn_usdc,
    depositAddress: latestSession?.depositAddress ?? null,
    lastSourceChain: latestSession?.sourceChain ?? null,
    balances,
    events,
    sessions
  };
}

async function readTreasuryRow(ownerWallet: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("sponsor_treasuries")
    .select("*")
    .eq("owner_wallet", ownerWallet)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load treasury record from Supabase: ${error.message}`);
  }

  return (data ?? null) as SponsorTreasuryRow | null;
}

async function readTreasurySession(ownerWallet: string, sessionId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("treasury_funding_sessions")
    .select("*")
    .eq("owner_wallet", ownerWallet)
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load treasury session from Supabase: ${error.message}`);
  }

  return (data ?? null) as TreasuryFundingSessionRow | null;
}

async function readTreasuryCollections(ownerWallet: string) {
  const supabase = getSupabaseServiceClient();
  const [balancesResult, sessionsResult, eventsResult] = await Promise.all([
    supabase
      .from("treasury_balances")
      .select("*")
      .eq("owner_wallet", ownerWallet)
      .order("updated_at", { ascending: false }),
    supabase
      .from("treasury_funding_sessions")
      .select("*")
      .eq("owner_wallet", ownerWallet)
      .order("created_at", { ascending: false })
      .limit(MAX_SESSIONS),
    supabase
      .from("treasury_events")
      .select("*")
      .eq("owner_wallet", ownerWallet)
      .order("created_at", { ascending: false })
      .limit(MAX_EVENTS)
  ]);

  if (balancesResult.error) {
    throw new Error(`Failed to load treasury balances from Supabase: ${balancesResult.error.message}`);
  }

  if (sessionsResult.error) {
    throw new Error(`Failed to load treasury sessions from Supabase: ${sessionsResult.error.message}`);
  }

  if (eventsResult.error) {
    throw new Error(`Failed to load treasury events from Supabase: ${eventsResult.error.message}`);
  }

  return {
    balanceRows: (balancesResult.data ?? null) as TreasuryBalanceRow[] | null,
    sessionRows: (sessionsResult.data ?? null) as TreasuryFundingSessionRow[] | null,
    eventRows: (eventsResult.data ?? null) as TreasuryEventRow[] | null
  };
}

async function loadSnapshot(ownerWallet: string): Promise<TreasurySnapshot> {
  const [treasuryRow, collections] = await Promise.all([readTreasuryRow(ownerWallet), readTreasuryCollections(ownerWallet)]);

  return buildLiveSnapshot({
    ownerWallet,
    treasuryRow,
    balanceRows: collections.balanceRows,
    sessionRows: collections.sessionRows,
    eventRows: collections.eventRows
  });
}

async function upsertTreasuryRow(input: Partial<SponsorTreasuryRow> & { owner_wallet: string }) {
  const supabase = getSupabaseServiceClient();
  const payload = {
    ...input,
    updated_at: nowIso()
  };
  const { error } = await supabase.from("sponsor_treasuries").upsert(payload, { onConflict: "owner_wallet" });

  if (error) {
    throw new Error(`Failed to persist treasury record into Supabase: ${error.message}`);
  }
}

async function upsertBalanceRows(rows: TreasuryBalanceRow[]) {
  const supabase = getSupabaseServiceClient();
  const payload = rows.map((item) => ({
    ...item,
    updated_at: nowIso()
  }));
  const { error } = await supabase
    .from("treasury_balances")
    .upsert(payload, { onConflict: "owner_wallet,chain_key,asset" });

  if (error) {
    throw new Error(`Failed to persist treasury balances into Supabase: ${error.message}`);
  }
}

async function upsertFundingSession(row: TreasuryFundingSessionRow) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("treasury_funding_sessions").upsert(row, { onConflict: "id" });

  if (error) {
    throw new Error(`Failed to persist treasury session into Supabase: ${error.message}`);
  }
}

async function insertTreasuryEvents(events: TreasuryEventRow[]) {
  if (!events.length) {
    return;
  }

  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("treasury_events").insert(events);

  if (error) {
    throw new Error(`Failed to persist treasury events into Supabase: ${error.message}`);
  }
}

function getRequiredWalletDetails(row: SponsorTreasuryRow, sourceChain: TreasurySourceChain) {
  const sourceConfig = SOURCE_CHAIN_CONFIG[sourceChain];
  const sourceWalletAddress = row[sourceConfig.walletAddressField];
  const sourceWalletId = row[sourceConfig.walletIdField];

  if (!sourceWalletAddress || !sourceWalletId || !row.arc_wallet_address || !row.arc_wallet_id) {
    throw new Error("Treasury wallets are incomplete. Recreate the treasury or check the Circle wallet set.");
  }

  return {
    sourceConfig,
    sourceWalletAddress,
    sourceWalletId,
    arcWalletAddress: row.arc_wallet_address,
    arcWalletId: row.arc_wallet_id
  };
}

function getArcBalance(snapshot: TreasurySnapshot) {
  return snapshot.balances.find((item) => item.chainKey === "arc")?.amount ?? "0";
}

function getBridgeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Bridge Kit could not complete the treasury transfer.";
}

function getSuccessfulBridgeTxHash(result: unknown) {
  const rawSteps = (result as { steps?: Array<{ txHash?: string; data?: { txHash?: string } }> } | null)?.steps ?? [];
  const stepWithHash = rawSteps.find((item) => item.txHash || item.data?.txHash);
  return stepWithHash?.txHash ?? stepWithHash?.data?.txHash ?? null;
}

async function createLiveWalletSet(ownerWallet: string) {
  const client = getDeveloperControlledWalletsClient();
  const label = `DCW-${ownerWallet.slice(2, 6).toUpperCase()}`;
  const walletSetResponse = await client.createWalletSet({
    name: `Arc Sponsor ${ownerWallet.slice(2, 10)}`
  });
  const walletSetId = (walletSetResponse.data?.walletSet as { id?: string } | undefined)?.id ?? null;

  if (!walletSetId) {
    throw new Error("Circle DCW did not return a wallet set id.");
  }

  const walletsResponse = await client.createWallets({
    count: 1,
    walletSetId,
    blockchains: [
      ARC_TREASURY_CHAIN.circleBlockchain,
      SOURCE_CHAIN_CONFIG["Base Sepolia"].circleBlockchain,
      SOURCE_CHAIN_CONFIG["Ethereum Sepolia"].circleBlockchain
    ]
  });
  const wallets = ((walletsResponse.data?.wallets as Array<{ id?: string; address?: string; blockchain?: string }> | undefined) ??
    []) as Array<{ id?: string; address?: string; blockchain?: string }>;

  const arcWallet = wallets.find((item) => item.blockchain === ARC_TREASURY_CHAIN.circleBlockchain);
  const baseWallet = wallets.find((item) => item.blockchain === SOURCE_CHAIN_CONFIG["Base Sepolia"].circleBlockchain);
  const ethereumWallet = wallets.find((item) => item.blockchain === SOURCE_CHAIN_CONFIG["Ethereum Sepolia"].circleBlockchain);

  if (!arcWallet?.id || !arcWallet.address || !baseWallet?.id || !baseWallet.address || !ethereumWallet?.id || !ethereumWallet.address) {
    throw new Error("Circle DCW did not return the expected Arc, Base Sepolia, and Ethereum Sepolia wallets.");
  }

  return {
    circleWalletLabel: label,
    circleWalletSetId: walletSetId,
    arcWallet,
    baseWallet,
    ethereumWallet
  };
}

export async function getLiveTreasurySnapshot(wallet: string): Promise<TreasuryResponse> {
  assertWallet(wallet);
  const ownerWallet = normalizeWallet(wallet);
  return { snapshot: await loadSnapshot(ownerWallet) };
}

export async function createLiveTreasury(wallet: string): Promise<TreasuryResponse> {
  assertWallet(wallet);
  const ownerWallet = normalizeWallet(wallet);
  const existing = await readTreasuryRow(ownerWallet);

  if (existing?.status === "ready") {
    return { snapshot: await loadSnapshot(ownerWallet) };
  }

  const walletSet = await createLiveWalletSet(ownerWallet);
  const createdAt = nowIso();

  await upsertTreasuryRow({
    owner_wallet: ownerWallet,
    status: "ready",
    circle_wallet_label: walletSet.circleWalletLabel,
    circle_wallet_set_id: walletSet.circleWalletSetId,
    arc_wallet_id: walletSet.arcWallet.id ?? null,
    arc_wallet_address: walletSet.arcWallet.address ?? null,
    base_wallet_id: walletSet.baseWallet.id ?? null,
    base_wallet_address: walletSet.baseWallet.address ?? null,
    ethereum_wallet_id: walletSet.ethereumWallet.id ?? null,
    ethereum_wallet_address: walletSet.ethereumWallet.address ?? null,
    total_funded_usdc: "0",
    total_withdrawn_usdc: "0",
    created_at: createdAt
  });

  await upsertBalanceRows([
    {
      owner_wallet: ownerWallet,
      chain_key: ARC_TREASURY_CHAIN.chainKey,
      chain_label: ARC_TREASURY_CHAIN.chainLabel,
      asset: "USDC",
      amount: "0",
      wallet_address: walletSet.arcWallet.address ?? null,
      updated_at: createdAt
    },
    {
      owner_wallet: ownerWallet,
      chain_key: SOURCE_CHAIN_CONFIG["Base Sepolia"].chainKey,
      chain_label: SOURCE_CHAIN_CONFIG["Base Sepolia"].chainLabel,
      asset: "USDC",
      amount: "0",
      wallet_address: walletSet.baseWallet.address ?? null,
      updated_at: createdAt
    },
    {
      owner_wallet: ownerWallet,
      chain_key: SOURCE_CHAIN_CONFIG["Ethereum Sepolia"].chainKey,
      chain_label: SOURCE_CHAIN_CONFIG["Ethereum Sepolia"].chainLabel,
      asset: "USDC",
      amount: "0",
      wallet_address: walletSet.ethereumWallet.address ?? null,
      updated_at: createdAt
    }
  ]);

  await insertTreasuryEvents([
    createDbEvent({
      owner_wallet: ownerWallet,
      kind: "treasury_created",
      status: "success",
      title: "Live sponsor treasury created",
      detail: "Circle DCW wallets were provisioned and Supabase persistence is now tracking your Arc funding lane.",
      metadata: null
    })
  ]);

  return { snapshot: await loadSnapshot(ownerWallet) };
}

export async function issueLiveDepositAddress(
  wallet: string,
  sourceChain: TreasurySourceChain,
  amount: string
): Promise<TreasuryResponse> {
  assertWallet(wallet);
  parseUsdcAmount(amount);
  const ownerWallet = normalizeWallet(wallet);
  const row = await readTreasuryRow(ownerWallet);

  if (!row || row.status !== "ready") {
    throw new Error("Create a live sponsor treasury before requesting a deposit address.");
  }

  const { sourceWalletAddress } = getRequiredWalletDetails(row, sourceChain);
  const createdAt = nowIso();
  const session: TreasuryFundingSessionRow = {
    id: crypto.randomUUID(),
    owner_wallet: ownerWallet,
    source_chain: sourceChain,
    target_chain: "Arc Testnet",
    amount,
    status: "address_issued",
    deposit_address: sourceWalletAddress,
    route_estimate: null,
    bridge_result: null,
    created_at: createdAt,
    updated_at: createdAt
  };

  await upsertFundingSession(session);
  await insertTreasuryEvents([
    createDbEvent({
      owner_wallet: ownerWallet,
      kind: "deposit_address_issued",
      status: "info",
      title: "Live deposit address issued",
      detail: `${amount} USDC can now be deposited into the ${sourceChain} Circle treasury lane before bridging to Arc.`,
      metadata: { sourceChain }
    })
  ]);

  return { snapshot: await loadSnapshot(ownerWallet) };
}

export async function simulateLiveBridge(wallet: string, sessionId: string): Promise<TreasuryResponse> {
  assertWallet(wallet);
  const ownerWallet = normalizeWallet(wallet);
  const [row, session, snapshotBefore] = await Promise.all([
    readTreasuryRow(ownerWallet),
    readTreasurySession(ownerWallet, sessionId),
    loadSnapshot(ownerWallet)
  ]);

  if (!row || row.status !== "ready") {
    throw new Error("Create a live sponsor treasury before bridging funds.");
  }

  if (!session) {
    throw new Error("Funding session not found.");
  }

  const { sourceConfig, sourceWalletAddress, arcWalletAddress } = getRequiredWalletDetails(row, session.source_chain);
  const adapter = getCircleWalletsAdapter();
  const kit = getBridgeKit();

  const bridgeParams = {
    from: {
      adapter,
      address: sourceWalletAddress,
      chain: BridgeChain[sourceConfig.bridgeChain]
    },
    to: {
      recipientAddress: arcWalletAddress,
      chain: BridgeChain[ARC_TREASURY_CHAIN.bridgeChain],
      useForwarder: true as const
    },
    amount: session.amount
  };

  try {
    const estimate = await kit.estimate(bridgeParams);
    await upsertFundingSession({
      ...session,
      status: "bridging",
      route_estimate: sanitizeForJson(estimate),
      updated_at: nowIso()
    });

    await insertTreasuryEvents([
      createDbEvent({
        owner_wallet: ownerWallet,
        kind: "deposit_received",
        status: "success",
        title: "Deposit assumed for bridge execution",
        detail: `${session.amount} USDC from ${session.source_chain} is now being routed into Arc through Bridge Kit.`,
        metadata: { sessionId: session.id }
      }),
      createDbEvent({
        owner_wallet: ownerWallet,
        kind: "bridge_started",
        status: "info",
        title: "Bridge execution started",
        detail: `Bridge Kit estimated the route and submitted the transfer from ${session.source_chain} into Arc.`,
        metadata: sanitizeForJson(estimate)
      })
    ]);

    const result = await kit.bridge(bridgeParams);

    if (result.state !== "success") {
      await upsertFundingSession({
        ...session,
        status: "address_issued",
        route_estimate: sanitizeForJson(estimate),
        bridge_result: sanitizeForJson(result),
        updated_at: nowIso()
      });

      await insertTreasuryEvents([
        createDbEvent({
          owner_wallet: ownerWallet,
          kind: "bridge_started",
          status: "warning",
          title: "Bridge follow-up required",
          detail:
            result.state === "pending"
              ? "Bridge Kit returned a pending state. Recheck the treasury lane after the transfer settles."
              : "Bridge Kit returned an error state. Review treasury balances and try the bridge again.",
          metadata: sanitizeForJson(result)
        })
      ]);

      return { snapshot: await loadSnapshot(ownerWallet) };
    }

    const nextArcBalance = addUsdc(getArcBalance(snapshotBefore), session.amount);

    await Promise.all([
      upsertTreasuryRow({
        owner_wallet: ownerWallet,
        total_funded_usdc: addUsdc(row.total_funded_usdc, session.amount)
      }),
      upsertBalanceRows([
        {
          owner_wallet: ownerWallet,
          chain_key: "arc",
          chain_label: ARC_TREASURY_CHAIN.chainLabel,
          asset: "USDC",
          amount: nextArcBalance,
          wallet_address: row.arc_wallet_address,
          updated_at: nowIso()
        }
      ]),
      upsertFundingSession({
        ...session,
        status: "completed",
        route_estimate: sanitizeForJson(estimate),
        bridge_result: sanitizeForJson(result),
        updated_at: nowIso()
      }),
      insertTreasuryEvents([
        createDbEvent({
          owner_wallet: ownerWallet,
          kind: "bridge_completed",
          status: "success",
          title: "Bridge completed on Arc",
          detail: `Treasury funds are now available on Arc Testnet and ready for wallet top-up or sponsor operations.`,
          metadata: {
            txHash: getSuccessfulBridgeTxHash(result),
            sessionId: session.id
          }
        })
      ])
    ]);

    return { snapshot: await loadSnapshot(ownerWallet) };
  } catch (error) {
    await upsertFundingSession({
      ...session,
      status: "address_issued",
      bridge_result: sanitizeForJson({ error: getBridgeErrorMessage(error) }),
      updated_at: nowIso()
    });

    await insertTreasuryEvents([
      createDbEvent({
        owner_wallet: ownerWallet,
        kind: "bridge_started",
        status: "warning",
        title: "Bridge attempt failed",
        detail: getBridgeErrorMessage(error),
        metadata: { sessionId: session.id }
      })
    ]);

    throw error;
  }
}

export async function withdrawLiveToWallet(wallet: string, amount: string): Promise<TreasuryResponse> {
  assertWallet(wallet);
  parseUsdcAmount(amount);
  const ownerWallet = normalizeWallet(wallet);
  const [row, snapshot] = await Promise.all([readTreasuryRow(ownerWallet), loadSnapshot(ownerWallet)]);

  if (!row || row.status !== "ready" || !row.arc_wallet_address) {
    throw new Error("Create a live sponsor treasury before moving funds to your connected wallet.");
  }

  const nextArcBalance = subtractUsdc(getArcBalance(snapshot), amount);
  const client = getDeveloperControlledWalletsClient();
  const transferResponse = await client.createTransaction({
    walletAddress: row.arc_wallet_address,
    blockchain: ARC_TREASURY_CHAIN.circleBlockchain,
    amount: [amount],
    destinationAddress: ownerWallet,
    tokenAddress: process.env.ARC_USDC_ADDRESS ?? ARC_CONTRACTS.usdc,
    fee: {
      type: "level",
      config: {
        feeLevel: "MEDIUM"
      }
    }
  });
  const transferData = (transferResponse.data ?? null) as { id?: string } | null;
  const transferId = transferData?.id ?? null;

  await Promise.all([
    upsertTreasuryRow({
      owner_wallet: ownerWallet,
      total_withdrawn_usdc: addUsdc(row.total_withdrawn_usdc, amount)
    }),
    upsertBalanceRows([
      {
        owner_wallet: ownerWallet,
        chain_key: "arc",
        chain_label: ARC_TREASURY_CHAIN.chainLabel,
        asset: "USDC",
        amount: nextArcBalance,
        wallet_address: row.arc_wallet_address,
        updated_at: nowIso()
      }
    ]),
    insertTreasuryEvents([
      createDbEvent({
        owner_wallet: ownerWallet,
        kind: "withdrawal_completed",
        status: "success",
        title: "Wallet transfer submitted",
        detail: `${amount} USDC was submitted from the Arc treasury wallet to your connected sponsor wallet.`,
        metadata: { transferId }
      })
    ])
  ]);

  return { snapshot: await loadSnapshot(ownerWallet) };
}
