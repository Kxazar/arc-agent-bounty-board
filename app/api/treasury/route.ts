import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getTreasurySnapshot } from "@/lib/treasury-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json({ error: "wallet query parameter is required" }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    return NextResponse.json(getTreasurySnapshot(cookieStore, wallet));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load treasury state." },
      { status: 400 }
    );
  }
}
