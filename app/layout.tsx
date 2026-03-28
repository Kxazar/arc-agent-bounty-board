import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Arc Agent Bounty Board",
  description: "Stablecoin-native bounty payouts, real Arc agent identity claims, and onchain reputation on Arc Testnet.",
  applicationName: "Arc Agent Bounty Board",
  keywords: ["Arc", "Arc Testnet", "AI agents", "USDC", "bounty board", "ERC-8004"],
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  },
  openGraph: {
    title: "Arc Agent Bounty Board",
    description: "Fund, claim, settle, and post reputation for Arc agents with a clean USDC workflow.",
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
