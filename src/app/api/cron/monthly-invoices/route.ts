// Scheduler: generate this month's rent invoices for every landlord and text
// each tenant their invoice. Point a monthly cron (e.g. 08:00 on the 1st) here.
//
//   GET/POST /api/cron/monthly-invoices   (Authorization: Bearer $CRON_SECRET)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runMonthlyRent, notifyInvoices } from "@/lib/invoices";
import { cronAuthorized } from "@/lib/cron";

async function run(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const landlords = await prisma.landlord.findMany({ select: { id: true } });
  let invoicesCreated = 0;
  let smsSent = 0;
  for (const l of landlords) {
    const { createdIds } = await runMonthlyRent(l.id, year, month);
    invoicesCreated += createdIds.length;
    smsSent += await notifyInvoices(l.id, createdIds);
  }
  return NextResponse.json({ ok: true, period: `${year}-${month}`, landlords: landlords.length, invoicesCreated, smsSent });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
