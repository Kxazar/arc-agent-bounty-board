import { formatUnits, type Address, type Hex } from "viem";

import { arcTestnet } from "@/lib/arc";

export function shortenAddress(address: Address | undefined) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUsdc(value: bigint) {
  return `${Number(formatUnits(value, 6)).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })} USDC`;
}

export function formatDateTime(value: bigint) {
  if (value === 0n) return "Not started";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(Number(value) * 1000);
}

export function explorerTxLink(hash: Hex) {
  return `${arcTestnet.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddressLink(address: Address) {
  return `${arcTestnet.blockExplorers.default.url}/address/${address}`;
}
