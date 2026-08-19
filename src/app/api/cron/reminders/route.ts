// Scheduler: SMS every tenant in arrears a payment reminder. Point a daily (or
// weekly) cron here. First runs sweepOverdue so freshly-overdue invoices count.
//
//   GET/POST /api/cron/reminders   (Authorization: Bearer $CRON_SECRET)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sweepOverdue, sendLeaseReminder } from "@/lib/invoices";
import { arrearsList } from "@/lib/stats";
import { cronAuthorized } from "@/lib/cron";

async function run(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const landlords = await prisma.landlord.findMany({ select: { id: true } });
  let reminders = 0;
  for (const l of landlords) {
    await sweepOverdue(l.id);
    const rows = await arrearsList(l.id);
    for (const r of rows) {
      const sent = await sendLeaseReminder(l.id, r.leaseId);
      if (sent) reminders += 1;
    }
  }
  return NextResponse.json({ ok: true, landlords: landlords.length, reminders });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
