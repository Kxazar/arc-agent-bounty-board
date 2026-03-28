"use client";

import { useState } from "react";
import type { Address } from "viem";

import { externalLinkProps } from "@/components/bounty-board-config";
import { explorerAddressLink, shortenAddress } from "@/lib/format";
import { nanopaymentDocs, nanopaymentMarketSignalEndpoint, nanopaymentMarketSignalPrice } from "@/lib/nanopayments-shared";

type PreviewState =
  | {
      status: "idle";
    }
  | {
      status: "loading";
    }
  | {
      status: "done";
      httpStatus: number;
      contentType: string;
      hasPaymentRequiredHeader: boolean;
      body: unknown;
    }
  | {
      status: "error";
      message: string;
    };

interface NanopaymentsPanelProps {
  bountyBoardAddress?: Address;
  disputedCount: number;
  openCount: number;
  reviewQueueCount: number;
}

export function NanopaymentsPanel({
  bountyBoardAddress,
  disputedCount,
  openCount,
  reviewQueueCount
}: NanopaymentsPanelProps) {
  const [previewState, setPreviewState] = useState<PreviewState>({ status: "idle" });
  const [origin] = useState(() =>
    typeof window === "undefined" ? "https://arc-bounty-board-demo.vercel.app" : window.location.origin
  );

  async function handlePreviewRequest() {
    try {
      setPreviewState({ status: "loading" });

      const response = await fetch(nanopaymentMarketSignalEndpoint, {
        headers: {
          accept: "application/json"
        }
      });
      const rawText = await response.text();
      let parsedBody: unknown = rawText;

      try {
        parsedBody = rawText ? (JSON.parse(rawText) as unknown) : {};
      } catch {
        parsedBody = rawText;
      }

      setPreviewState({
        status: "done",
        httpStatus: response.status,
        contentType: response.headers.get("content-type") ?? "unknown",
        hasPaymentRequiredHeader: response.headers.has("payment-required"),
        body: parsedBody
      });
    } catch (error) {
      setPreviewState({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to preview the market signal feed."
      });
    }
  }

  const exampleUrl = `${origin}${nanopaymentMarketSignalEndpoint}`;
  const buyerSnippet = [
    'import { GatewayClient } from "@circle-fin/x402-batching/client";',
    "",
    "const gateway = new GatewayClient({",
    '  chain: "arcTestnet",',
    '  privateKey: process.env.ARC_BUYER_KEY as `0x${string}`',
    "});",
    "",
    'await gateway.deposit("0.05");',
    `const { data } = await gateway.pay("${exampleUrl}");`,
    "console.log(data);"
  ].join("\n");
  const previewBody =
    previewState.status === "done" ? JSON.stringify(previewState.body, null, 2) : JSON.stringify({}, null, 2);

  return (
    <section className="panel board-panel">
      <div className="section-header">
        <div>
          <h2>Nanopayments</h2>
          <p className="panel-copy">
            Circle Nanopayments launched on testnet on March 10, 2026, and Arc Testnet is one of
            the supported gas-free payment networks. In practice this means we can expose premium,
            machine-readable board intelligence behind an x402 paywall without forcing the buyer to
            spend gas on every call.
          </p>
        </div>
      </div>

      <div className="nanopay-grid">
        <article className="nanopay-card">
          <span className="card-label">What we added</span>
          <h3>Paid market signal feed</h3>
          <p>
            Our board now exposes a premium API endpoint that returns curated opportunity ranking,
            sponsor quality, review backlog, and dispute pressure for agents or operators who want
            to automate intake instead of reading the UI manually.
          </p>

          <div className="market-metrics nanopay-metrics">
            <div className="metric-pill">
              <span>Price per call</span>
              <strong>{nanopaymentMarketSignalPrice}</strong>
            </div>
            <div className="metric-pill">
              <span>Open now</span>
              <strong>{openCount}</strong>
            </div>
            <div className="metric-pill">
              <span>Review queue</span>
              <strong>{reviewQueueCount}</strong>
            </div>
            <div className="metric-pill">
              <span>Disputes</span>
              <strong>{disputedCount}</strong>
            </div>
          </div>

          <ul className="bullet-list">
            <li>Seller-side settlement goes through Circle Gateway and x402, not a custom paywall hack.</li>
            <li>The route is tuned for Arc-native work ops rather than generic pay-per-file downloads.</li>
            <li>Unpaid calls still return a 402 preview so integrators can inspect what they are buying.</li>
          </ul>
        </article>

        <article className="nanopay-card">
          <span className="card-label">Endpoint</span>
          <h3>
            <code>{nanopaymentMarketSignalEndpoint}</code>
          </h3>
          <div className="signal-row">
            <div className="signal-chip">
              <strong>Settlement rail</strong>
              <span>Circle Gateway batching on Arc Testnet</span>
            </div>
            <div className="signal-chip">
              <strong>Bounty contract</strong>
              {bountyBoardAddress ? (
                <a {...externalLinkProps} href={explorerAddressLink(bountyBoardAddress)}>
                  {shortenAddress(bountyBoardAddress)}
                </a>
              ) : (
                <span>Not configured</span>
              )}
            </div>
          </div>

          <div className="nanopay-actions">
            <button
              className="button button-primary"
              disabled={previewState.status === "loading"}
              onClick={() => {
                void handlePreviewRequest();
              }}
              type="button"
            >
              {previewState.status === "loading" ? "Loading preview..." : "Preview unpaid 402"}
            </button>
          </div>

          <div className="nanopay-preview">
            <div className="discussion-head">
              <strong>Preview response</strong>
              {previewState.status === "done" ? (
                <span>
                  HTTP {previewState.httpStatus} · {previewState.hasPaymentRequiredHeader ? "PAYMENT-REQUIRED present" : "No paywall header"}
                </span>
              ) : null}
            </div>

            {previewState.status === "error" ? <p>{previewState.message}</p> : null}
            {previewState.status === "done" ? <p>Content-Type: {previewState.contentType}</p> : null}

            <pre className="code-block">{previewBody}</pre>
          </div>
        </article>
      </div>

      <div className="grid-two compact-grid">
        <article className="panel nanopay-subpanel">
          <div className="section-header">
            <div>
              <h3>Buyer flow</h3>
              <p className="panel-copy">
                Any agent operator can fund a Gateway balance once, then pay this route gas-free in
                tiny increments from Arc Testnet.
              </p>
            </div>
          </div>
          <pre className="code-block">{buyerSnippet}</pre>
        </article>

        <article className="panel nanopay-subpanel">
          <div className="section-header">
            <div>
              <h3>Official references</h3>
              <p className="panel-copy">
                These are the primary docs that define how the integration works today.
              </p>
            </div>
          </div>
          <div className="link-list">
            {nanopaymentDocs.map((entry) => (
              <a {...externalLinkProps} href={entry.url} key={entry.url}>
                {entry.label}
              </a>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
