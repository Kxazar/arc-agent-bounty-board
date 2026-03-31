import { encodeFunctionData, type Abi, type Address, type Hex, type WalletClient } from "viem";
import { getCapabilities, sendCalls, waitForCallsStatus } from "viem/actions";

import { arcTestnet } from "@/lib/arc";

type AtomicBatchCall = {
  address: Address;
  abi: unknown;
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
};

type AtomicBatchResult = {
  supported: boolean;
  hash: Hex | null;
};

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const maybeCode = "code" in error ? error.code : "cause" in error && typeof error.cause === "object" && error.cause
      ? "code" in error.cause
        ? error.cause.code
        : undefined
      : undefined;

    if (typeof maybeCode === "number") {
      return maybeCode;
    }
  }

  return null;
}

export function isBatchingUnsupportedError(error: unknown) {
  const code = getErrorCode(error);

  if (code === 4200 || code === -32601) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("wallet_sendcalls") ||
    message.includes("wallet_getcapabilities") ||
    message.includes("eip-5792") ||
    (message.includes("method") && message.includes("not found")) ||
    (message.includes("not supported") && (message.includes("wallet") || message.includes("atomic"))) ||
    message.includes("unsupported method")
  );
}

export async function sendAtomicCallsIfSupported(params: {
  walletClient: WalletClient | undefined;
  account: Address;
  calls: AtomicBatchCall[];
}): Promise<AtomicBatchResult> {
  const { walletClient, account, calls } = params;

  if (!walletClient || calls.length === 0) {
    return {
      supported: false,
      hash: null
    };
  }

  try {
    const capabilities = await getCapabilities(walletClient, {
      account,
      chainId: arcTestnet.id
    });

    if (capabilities.atomic?.status === "unsupported") {
      return {
        supported: false,
        hash: null
      };
    }
  } catch (error) {
    if (isBatchingUnsupportedError(error)) {
      return {
        supported: false,
        hash: null
      };
    }

    throw error;
  }

  try {
    const response = await sendCalls(walletClient, {
      account,
      chain: arcTestnet,
      calls: calls.map((call) => ({
        to: call.address,
        data: encodeFunctionData({
          abi: call.abi as Abi,
          functionName: call.functionName,
          args: call.args
        }),
        value: call.value
      })),
      forceAtomic: true,
      experimental_fallback: false
    });

    const status = await waitForCallsStatus(walletClient, {
      id: response.id,
      timeout: 120_000,
      throwOnFailure: true
    });
    const hash = (status.receipts?.[status.receipts.length - 1]?.transactionHash as Hex | undefined) ?? null;

    return {
      supported: true,
      hash
    };
  } catch (error) {
    if (isBatchingUnsupportedError(error)) {
      return {
        supported: false,
        hash: null
      };
    }

    throw error;
  }
}
