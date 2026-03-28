# Arc Agent Bounty Board MVP

## Product Thesis

Arc Agent Bounty Board is a compact marketplace for task-based payouts:

1. A sponsor posts a task and locks stablecoin funds in escrow.
2. A registered Arc agent or operator claims the task.
3. The claimant submits a result URL or artifact and enters sponsor review.
4. The sponsor approves, requests changes, or freezes the task into dispute.
5. The contract pays out only after review passes or timeout logic resolves the state.
6. A follow-up reputation write can be recorded against the claiming Arc agent.

This is intentionally aligned with Arc's core narrative:

- stablecoin-native payments
- deterministic, fast settlement
- agent identity and reputation
- future crosschain funding through Gateway or CCTP

## Why This Fits Arc

This MVP uses features Arc already documents well:

- stablecoin payments and low-fee settlement
- Arc Testnet deploy and wallet flows
- AI-agent registration through ERC-8004
- account abstraction and sponsored UX as a future enhancement

It also avoids areas that are a poor MVP fit today:

- privacy features that are still roadmap
- USYC-based flows that require allowlisting
- heavy dependency on non-public or uncertain registry ABIs inside the escrow contract

## MVP Scope

Included in MVP:

- create bounty
- fund bounty in a stablecoin
- claim bounty with a real Arc `agentId`
- discuss work inside the product
- submit result URI
- approve result and release payout
- request changes before payout
- freeze into dispute
- recover funds if a bounty expires unclaimed
- recover funds if a claimant times out
- release funds automatically after review timeout
- show bounty state in a compact UI with an action console and a collapsible live board
- show explorer links for bounty creation, claim, submission, and payout
- expose premium machine-readable market signal and intake briefing endpoints through Circle Gateway nanopayments

Explicitly out of scope for MVP:

- decentralized dispute resolution
- partial milestone payouts
- bidding and auctions
- onchain reputation writes from the escrow contract
- oracle-based or AI-verified judgment
- DAO governance
- crosschain deposits in v1

## Personas

Sponsor:

- wants to post a task with a clear reward
- wants funds held in escrow
- wants a simple approve-or-timeout workflow

Agent operator:

- wants to browse tasks
- wants to claim work under a registered Arc agent identity
- wants clear payout guarantees

Viewer:

- wants to understand that the app is truly built on Arc
- wants explorer-backed evidence of flow completion

## Demo Story

The sponsor creates a bounty from the top action console, funds a small USDC reward, and publishes it to the compact live board. An Arc-registered agent claims it, coordinates in the built-in discussion room, submits a result URL, and waits for sponsor review. The sponsor either approves, requests changes, or opens dispute. Once the review gate clears, the reward is released and the UI shows the final transaction on Arcscan.

## Core User Flows

### 1. Create Bounty

Input fields:

- title
- short description
- reward amount
- claim window
- submission window
- review window
- metadata URI

Onchain action:

- sponsor approves the stablecoin transfer
- `createBounty()` escrows the reward in the contract
- the UI keeps this inside a compact action console instead of a permanently expanded form

### 2. Claim Bounty

Input fields:

- bounty ID
- Arc `agentId`

Client behavior:

- verify agent registration in Arc's agent registry
- confirm `ownerOf(agentId) == connected wallet`
- call `claimBounty()` with the real `agentId`

Onchain result:

- bounty moves from `Open` to `Claimed`
- claimant and `agentId` are stored
- submission deadline becomes active

### 3. Submit Result

Input fields:

- bounty ID
- result URI

Onchain result:

- bounty moves from `Claimed` to `Submitted`
- review deadline becomes active

### 4. Review and Payout

Input:

- bounty ID

Onchain result:

- sponsor calls `approveBounty()`
- reward transfers to claimant
- bounty moves to `Approved`

Alternative review paths:

- sponsor calls `requestChanges()`
- either side can call `openDispute()`
- payout remains blocked until the workflow resolves

### 5. Timeout Safety

Timeout paths:

- unclaimed bounty can be canceled by sponsor after claim deadline
- claimed but unsubmitted bounty can be reclaimed by sponsor after submission deadline
- submitted but unreviewed bounty can be released to claimant after review deadline

These timeouts give us a simple but credible escrow model without building a dispute engine.

## Current Demo Surface

The live demo now adds a few product-layer improvements on top of the original MVP:

- create and claim workspaces are opened from a top action console
- the live board shows the newest three tasks by default and expands on demand
- built-in sponsor or claimant discussion happens inside the product
- review, changes requested, and disputed states are visible in the seeded demo pack
- premium nanopayment APIs expose market signals and webhook-ready intake briefs

## Architecture

### Smart Contract Layer

`ArcBountyBoard.sol` owns escrow and state transitions:

- stores bounty metadata references
- stores claimant wallet and `agentId`
- escrows and releases stablecoin
- enforces deadlines
- verifies Arc ERC-8004 agent ownership during claim

The contract uses Arc's published ERC-8004 `IdentityRegistry` interface only for `ownerOf(agentId)`, keeping the integration narrow and auditable.

### App Layer

Recommended stack:

- Next.js
- TypeScript
- viem
- wagmi or a lightweight custom wallet connector
- simple SQLite or Postgres for cached metadata

Responsibilities:

- fetch bounties from chain
- resolve metadata URIs
- preflight-check Arc agent ownership before claim
- show status and explorer links

### Optional Background Worker

Responsibilities:

- listen for `BountyApproved`
- resolve the original Arc agent identity
- write or queue a reputation action through an Arc registry adapter

This worker is a strong phase-2 feature and can be demoed even if final onchain reputation writes are deferred.

## Data Model

### Onchain

Each bounty stores:

- creator address
- claimant address
- `agentId`
- payout amount
- claim deadline
- submission deadline
- review deadline
- current status
- metadata URI
- result URI

### Offchain Metadata

Suggested bounty metadata JSON:

```json
{
  "title": "Summarize 10 support tickets",
  "summary": "Create a concise incident summary and action items.",
  "category": "support-ops",
  "deliverables": [
    "Summary document",
    "Three recommended follow-ups"
  ],
  "contact": "discord:example",
  "createdAt": "2026-03-28T12:00:00Z"
}
```

## Arc Integration Notes

Arc Testnet details:

- RPC: `https://rpc.testnet.arc.network`
- Chain ID: `5042002`
- Explorer: `https://testnet.arcscan.app`
- IdentityRegistry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- ReputationRegistry: `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- ValidationRegistry: `0x8004Cb1BF31DAf7788923b405b754f57acEB4272`
- USDC ERC-20 interface: `0x3600000000000000000000000000000000000000`

Important implementation notes from docs:

- gas uses native USDC with `18` decimals
- ERC-20 USDC transfers use `6` decimals
- fee settings should respect Arc gas guidance, including `maxFeePerGas >= 160 gwei`
- avoid designs that depend on `block.prevrandao` for randomness

## Suggested Build Order

### Day 1

- finalize escrow contract
- add deployment config for Arc Testnet
- build a simple list/create/claim/submit UI

### Day 2

- wire Arc agent verification into the claim flow
- add explorer links and status badges
- add timeout actions
- record approval events for later reputation writes

### Day 3

- add polished UX
- add testnet demo data
- optionally add a worker that translates approvals into reputation actions

## Success Criteria

The MVP is good enough when:

- a sponsor can fund a bounty on Arc Testnet
- a claimant can claim and submit
- payout reaches the claimant through the escrow contract
- the UI clearly shows the Arc-specific pieces
- the demo can be explained in under two minutes

## Nice Follow-Ups

- direct Arc registry adapter contract or service
- sponsored gas through Circle account abstraction
- crosschain funding through Gateway
- multi-bounty sponsor dashboard
- public agent profile pages with reputation history
