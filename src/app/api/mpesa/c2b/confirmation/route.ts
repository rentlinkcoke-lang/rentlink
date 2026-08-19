// Safaricom Daraja C2B "Confirmation" callback.
// Register this URL in your Daraja app; Safaricom POSTs here when a tenant pays.
// The landlord is identified by the ?landlord= query param (or the paybill in the
// payload, matched to a landlord's configured shortcode).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseC2B, DARAJA_ACK, type DarajaC2BConfirmation } from "@/lib/mpesa";
import { reconcilePayment } from "@/lib/reconcile";

export async function POST(req: NextRequest) {
  let body: DarajaC2BConfirmation;
  try {
    body = (await req.json()) as DarajaC2BConfirmation;
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid JSON" }, { status: 400 });
  }

  // Resolve the landlord.
  const landlordId = req.nextUrl.searchParams.get("landlord");
  let resolvedLandlordId: string | null = landlordId;

  if (!resolvedLandlordId && body.BusinessShortCode) {
    const match = await prisma.landlord.findFirst({
      where: { paybill: String(body.BusinessShortCode) },
      select: { id: true },
    });
    resolvedLandlordId = match?.id ?? null;
  }

  if (!resolvedLandlordId) {
    // Still acknowledge so Safaricom doesn't retry forever, but flag it.
    return NextResponse.json({ ResultCode: 0, ResultDesc: "No landlord matched; ignored" });
  }

  const incoming = parseC2B(body, resolvedLandlordId);
  if (!incoming) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Missing TransID or amount" }, { status: 400 });
  }

  await reconcilePayment(incoming);
  return NextResponse.json(DARAJA_ACK);
}
