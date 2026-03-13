import { NextResponse } from "next/server";

import { runOfficialIngestion } from "@/lib/store";

export async function POST(request: Request) {
  const provided = request.headers.get("x-sync-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.SYNC_WEBHOOK_SECRET;

  if (!expected || provided !== expected) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await runOfficialIngestion(true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Sync failed" }, { status: 500 });
  }
}
