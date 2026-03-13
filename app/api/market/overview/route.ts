import { NextResponse } from "next/server";

import { getMarketOverview } from "@/lib/store";

export async function GET() {
  return NextResponse.json(await getMarketOverview());
}

