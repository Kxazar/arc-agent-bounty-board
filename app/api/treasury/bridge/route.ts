import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { persistTreasurySnapshot, simulateBridge } from "@/lib/treasury-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      wallet?: string;
      sessionId?: string;
    };

    if (!body.wallet || !body.sessionId) {
      return NextResponse.json({ error: "wallet and sessionId are required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const payload = await simulateBridge(cookieStore, body.wallet, body.sessionId);
    const response = NextResponse.json(payload);
    persistTreasurySnapshot(response.cookies, payload.snapshot);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to simulate treasury bridge." },
      { status: 400 }
    );
  }
}
