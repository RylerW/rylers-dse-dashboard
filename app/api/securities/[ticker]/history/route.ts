import { NextResponse } from "next/server";

import { getSecurityByTicker } from "@/lib/store";

export async function GET(_: Request, context: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await context.params;
  const security = await getSecurityByTicker(ticker);
  if (!security) {
    return NextResponse.json({ message: "Security not found" }, { status: 404 });
  }
  return NextResponse.json(security.history);
}

