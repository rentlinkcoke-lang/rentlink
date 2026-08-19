// P&L CSV export. Session-authenticated; streams a CSV for ?period=YYYY-MM.

import { NextRequest, NextResponse } from "next/server";
import { getSessionLandlordId } from "@/lib/auth";
import { profitAndLoss, pnlToCsv } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const landlordId = await getSessionLandlordId();
  if (!landlordId) return new NextResponse("Unauthorized", { status: 401 });

  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;
  const period = req.nextUrl.searchParams.get("period");
  if (period && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    year = y; month = m;
  }

  const pnl = await profitAndLoss(landlordId, year, month);
  const csv = pnlToCsv(pnl);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="keja-pnl-${year}-${String(month).padStart(2, "0")}.csv"`,
    },
  });
}
