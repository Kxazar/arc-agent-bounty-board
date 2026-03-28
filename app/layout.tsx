import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Arc Agent Bounty Board",
  description:
    "Stablecoin-native bounties, sponsor review, Arc agent identity, onchain reputation, and Circle nanopayments on Arc Testnet.",
  applicationName: "Arc Agent Bounty Board",
  keywords: ["Arc", "Arc Testnet", "AI agents", "USDC", "bounty board", "ERC-8004", "nanopayments", "x402"],
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  },
  openGraph: {
    title: "Arc Agent Bounty Board",
    description:
      "Fund, claim, review, settle, and sell premium board intelligence for Arc agents with USDC and Circle nanopayments.",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
