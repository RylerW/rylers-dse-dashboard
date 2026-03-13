import { NextResponse } from "next/server";

import { listSecurities } from "@/lib/store";

export async function GET() {
  return NextResponse.json(await listSecurities());
}

