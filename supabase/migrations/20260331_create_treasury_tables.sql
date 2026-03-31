create extension if not exists pgcrypto;

create table if not exists public.sponsor_treasuries (
  owner_wallet text primary key,
  status text not null default 'not_created',
  circle_wallet_label text,
  circle_wallet_set_id text,
  arc_wallet_id text,
  arc_wallet_address text,
  base_wallet_id text,
  base_wallet_address text,
  ethereum_wallet_id text,
  ethereum_wallet_address text,
  total_funded_usdc text not null default '0',
  total_withdrawn_usdc text not null default '0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.treasury_balances (
  id uuid primary key default gen_random_uuid(),
  owner_wallet text not null references public.sponsor_treasuries (owner_wallet) on delete cascade,
  chain_key text not null,
  chain_label text not null,
  asset text not null default 'USDC',
  amount text not null default '0',
  wallet_address text,
  updated_at timestamptz not null default now(),
  unique (owner_wallet, chain_key, asset)
);

create table if not exists public.treasury_funding_sessions (
  id uuid primary key,
  owner_wallet text not null references public.sponsor_treasuries (owner_wallet) on delete cascade,
  source_chain text not null,
  target_chain text not null default 'Arc Testnet',
  amount text not null,
  status text not null,
  deposit_address text not null,
  route_estimate jsonb,
  bridge_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.treasury_events (
  id uuid primary key,
  owner_wallet text not null references public.sponsor_treasuries (owner_wallet) on delete cascade,
  kind text not null,
  status text not null,
  title text not null,
  detail text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists treasury_balances_owner_wallet_idx on public.treasury_balances (owner_wallet);
create index if not exists treasury_funding_sessions_owner_wallet_idx on public.treasury_funding_sessions (owner_wallet, created_at desc);
create index if not exists treasury_events_owner_wallet_idx on public.treasury_events (owner_wallet, created_at desc);
