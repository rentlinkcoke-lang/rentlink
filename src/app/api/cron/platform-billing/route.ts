// Scheduler: issue RentLink's monthly per-unit subscription invoices to every
// landlord whose trial has ended. Point a monthly cron (e.g. 1st, 06:00) here.
//
//   GET/POST /api/cron/platform-billing   (Authorization: Bearer $CRON_SECRET)

import { NextRequest, NextResponse } from "next/server";
import { runPlatformBilling } from "@/lib/platform-billing";
import { cronAuthorized } from "@/lib/cron";

async function run(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const result = await runPlatformBilling(now.getUTCFullYear(), now.getUTCMonth() + 1);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
