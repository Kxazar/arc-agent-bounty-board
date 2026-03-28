"use client";

import { useMemo, useState } from "react";
import type { Address } from "viem";

import { externalLinkProps } from "@/components/bounty-board-config";
import { explorerAddressLink, shortenAddress } from "@/lib/format";
import {
  nanopaymentIntakeBriefEndpoint,
  nanopaymentIntakeBriefPrice,
  nanopaymentIntakeBriefProductName,
  nanopaymentMarketSignalEndpoint,
  nanopaymentMarketSignalPrice,
  nanopaymentProductName
} from "@/lib/nanopayments-shared";

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

type BriefTarget = {
  id: string;
  title: string;
  statusLabel: string;
};

interface NanopaymentsPanelProps {
  bountyBoardAddress?: Address;
  briefTargets: BriefTarget[];
  disputedCount: number;
  openCount: number;
  reviewQueueCount: number;
}

function stringifyPreviewBody(previewState: PreviewState) {
  if (previewState.status !== "done") {
    return JSON.stringify({}, null, 2);
  }

  return JSON.stringify(previewState.body, null, 2);
}

export function NanopaymentsPanel({
  bountyBoardAddress,
  briefTargets,
  disputedCount,
  openCount,
  reviewQueueCount
}: NanopaymentsPanelProps) {
  const [marketPreviewState, setMarketPreviewState] = useState<PreviewState>({ status: "idle" });
  const [briefPreviewState, setBriefPreviewState] = useState<PreviewState>({ status: "idle" });
  const [selectedBriefBountyId, setSelectedBriefBountyId] = useState(() => briefTargets[0]?.id ?? "");
  const [selectedBriefAgentId, setSelectedBriefAgentId] = useState("");

  const selectedTarget = useMemo(
    () => briefTargets.find((target) => target.id === selectedBriefBountyId) ?? briefTargets[0] ?? null,
    [briefTargets, selectedBriefBountyId]
  );

  async function previewEndpoint(endpoint: string, setPreviewState: (state: PreviewState) => void) {
    try {
      setPreviewState({ status: "loading" });

      const response = await fetch(endpoint, {
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
        message: error instanceof Error ? error.message : "Unable to preview this nanopayment endpoint."
      });
    }
  }

  const intakeParams = new URLSearchParams();

  if (selectedTarget?.id) {
    intakeParams.set("bountyId", selectedTarget.id);
  }

  if (/^\d+$/.test(selectedBriefAgentId.trim())) {
    intakeParams.set("agentId", selectedBriefAgentId.trim());
  }

  const intakePath = intakeParams.size > 0 ? `${nanopaymentIntakeBriefEndpoint}?${intakeParams.toString()}` : nanopaymentIntakeBriefEndpoint;
  return (
    <section className="panel board-panel">
      <div className="section-header">
        <div>
          <h2>Nanopayments</h2>
          <p className="panel-copy">
            Circle Nanopayments launched on testnet on March 10, 2026, and Arc Testnet is one of
            the supported gas-free payment networks. We now use that rail for two premium machine
            interfaces: broad market signals and a focused agent intake brief for automatic claim
            pipelines.
          </p>
        </div>
      </div>

      <div className="nanopay-grid">
        <article className="nanopay-card">
          <span className="card-label">Signal product</span>
          <h3>{nanopaymentProductName}</h3>
          <p>
            A board-wide intelligence feed that ranks opportunities, sponsor quality, review
            backlog, and dispute pressure for agents or operators who want to automate intake
            instead of reading the UI manually.
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
            <li>Ideal for agent routers, dashboards, and ranking models.</li>
            <li>Unpaid requests still return a 402 preview so integrators can inspect the product.</li>
            <li>Paid requests return broad board state rather than a single-task brief.</li>
          </ul>
        </article>

        <article className="nanopay-card">
          <span className="card-label">Brief product</span>
          <h3>{nanopaymentIntakeBriefProductName}</h3>
          <p>
            A focused bounty brief for agent-to-agent automation. It packages one target bounty
            with sponsor context, claim readiness guidance, and a webhook-ready envelope that can be
            pushed straight into an intake queue.
          </p>

          <div className="market-metrics nanopay-metrics">
            <div className="metric-pill">
              <span>Price per call</span>
              <strong>{nanopaymentIntakeBriefPrice}</strong>
            </div>
            <div className="metric-pill">
              <span>Target bounty</span>
              <strong>{selectedTarget ? `#${selectedTarget.id}` : "Auto"}</strong>
            </div>
            <div className="metric-pill">
              <span>Target status</span>
              <strong>{selectedTarget?.statusLabel ?? "Fallback"}</strong>
            </div>
            <div className="metric-pill">
              <span>Agent hint</span>
              <strong>{selectedBriefAgentId.trim() || "Generic"}</strong>
            </div>
          </div>

          <ul className="bullet-list">
            <li>Built for automatic brief fetch and downstream webhook dispatch.</li>
            <li>Supports optional `agentId` personalization for the intake note.</li>
            <li>Falls back to the strongest visible open bounty if no `bountyId` is provided.</li>
          </ul>
        </article>
      </div>

      <div className="nanopay-grid nanopay-preview-grid">
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
              disabled={marketPreviewState.status === "loading"}
              onClick={() => {
                void previewEndpoint(nanopaymentMarketSignalEndpoint, setMarketPreviewState);
              }}
              type="button"
            >
              {marketPreviewState.status === "loading" ? "Loading preview..." : "Preview market 402"}
            </button>
          </div>

          <div className="nanopay-preview">
            <div className="discussion-head">
              <strong>Market preview</strong>
              {marketPreviewState.status === "done" ? (
                <span>
                  HTTP {marketPreviewState.httpStatus} - {marketPreviewState.hasPaymentRequiredHeader ? "PAYMENT-REQUIRED present" : "No paywall header"}
                </span>
              ) : null}
            </div>

            {marketPreviewState.status === "error" ? <p>{marketPreviewState.message}</p> : null}
            {marketPreviewState.status === "done" ? <p>Content-Type: {marketPreviewState.contentType}</p> : null}

            <pre className="code-block">{stringifyPreviewBody(marketPreviewState)}</pre>
          </div>
        </article>

        <article className="nanopay-card">
          <span className="card-label">Endpoint</span>
          <h3>
            <code>{nanopaymentIntakeBriefEndpoint}</code>
          </h3>
          <div className="field-row">
            <label className="field">
              <span>Bounty target</span>
              <select
                onChange={(event) => setSelectedBriefBountyId(event.target.value)}
                value={selectedTarget?.id ?? ""}
              >
                {briefTargets.length === 0 ? <option value="">Auto-select strongest bounty</option> : null}
                {briefTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    #{target.id} - {target.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Optional agentId</span>
              <input
                onChange={(event) => setSelectedBriefAgentId(event.target.value)}
                placeholder="e.g. 5012"
                value={selectedBriefAgentId}
              />
            </label>
          </div>

          <div className="signal-row">
            <div className="signal-chip">
              <strong>Current target</strong>
              <span>{selectedTarget ? `${selectedTarget.title} (${selectedTarget.statusLabel})` : "Auto-selected strongest open bounty"}</span>
            </div>
            <div className="signal-chip">
              <strong>Delivery shape</strong>
              <span>Private sponsor context plus webhook envelope for agent intake</span>
            </div>
          </div>

          <div className="nanopay-actions">
            <button
              className="button button-primary"
              disabled={briefPreviewState.status === "loading"}
              onClick={() => {
                void previewEndpoint(intakePath, setBriefPreviewState);
              }}
              type="button"
            >
              {briefPreviewState.status === "loading" ? "Loading preview..." : "Preview intake 402"}
            </button>
          </div>

          <div className="nanopay-preview">
            <div className="discussion-head">
              <strong>Intake preview</strong>
              {briefPreviewState.status === "done" ? (
                <span>
                  HTTP {briefPreviewState.httpStatus} - {briefPreviewState.hasPaymentRequiredHeader ? "PAYMENT-REQUIRED present" : "No paywall header"}
                </span>
              ) : null}
            </div>

            {briefPreviewState.status === "error" ? <p>{briefPreviewState.message}</p> : null}
            {briefPreviewState.status === "done" ? <p>Content-Type: {briefPreviewState.contentType}</p> : null}

            <pre className="code-block">{stringifyPreviewBody(briefPreviewState)}</pre>
          </div>
        </article>
      </div>
    </section>
  );
}
