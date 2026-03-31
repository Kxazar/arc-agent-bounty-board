import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createTreasury, persistTreasurySnapshot } from "@/lib/treasury-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { wallet?: string };

    if (!body.wallet) {
      return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const payload = await createTreasury(cookieStore, body.wallet);
    const response = NextResponse.json(payload);
    persistTreasurySnapshot(response.cookies, payload.snapshot);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create treasury." },
      { status: 400 }
    );
  }
}
