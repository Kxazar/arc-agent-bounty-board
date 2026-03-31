import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { persistTreasurySnapshot, withdrawToWallet } from "@/lib/treasury-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      wallet?: string;
      amount?: string;
    };

    if (!body.wallet || !body.amount) {
      return NextResponse.json({ error: "wallet and amount are required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const payload = withdrawToWallet(cookieStore, body.wallet, body.amount);
    const response = NextResponse.json(payload);
    persistTreasurySnapshot(response.cookies, payload.snapshot);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to withdraw treasury funds." },
      { status: 400 }
    );
  }
}
