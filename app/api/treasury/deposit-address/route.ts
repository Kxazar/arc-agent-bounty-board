import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { issueDepositAddress, persistTreasurySnapshot } from "@/lib/treasury-service";
import type { TreasurySourceChain } from "@/lib/treasury-types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      wallet?: string;
      sourceChain?: TreasurySourceChain;
      amount?: string;
    };

    if (!body.wallet || !body.sourceChain || !body.amount) {
      return NextResponse.json({ error: "wallet, sourceChain, and amount are required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const payload = await issueDepositAddress(cookieStore, body.wallet, body.sourceChain, body.amount);
    const response = NextResponse.json(payload);
    persistTreasurySnapshot(response.cookies, payload.snapshot);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to issue deposit address." },
      { status: 400 }
    );
  }
}
