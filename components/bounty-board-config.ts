import type { CreateForm } from "@/components/bounty-board-types";

export const statusLabels = [
  "Open",
  "Claimed",
  "Submitted",
  "Changes requested",
  "Approved",
  "Disputed",
  "Cancelled"
] as const;

export const externalLinkProps = {
  target: "_blank",
  rel: "noreferrer"
} as const;

export const defaultCreateForm: CreateForm = {
  title: "Summarize 10 support tickets",
  summary: "Deliver a concise summary with three action items.",
  contact: "alexe",
  reward: "0.85",
  milestoneSplit: "100",
  claimWindowValue: "30",
  claimWindowUnit: "days",
  submissionHours: "48",
  reviewHours: "24"
};
