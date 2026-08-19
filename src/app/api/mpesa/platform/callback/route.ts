// STK callback for PLATFORM (subscription) payments — a landlord paying their
// RentLink fee. Correlates by CheckoutRequestID stored on the PlatformInvoice.
//
//   POST /api/mpesa/platform/callback

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface StkCallbackBody {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: { Name: string; Value?: string | number }[] };
    };
  };
}

export async function POST(req: NextRequest) {
  let body: StkCallbackBody;
  try {
    body = (await req.json()) as StkCallbackBody;
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid JSON" }, { status: 400 });
  }

  const cb = body.Body?.stkCallback;
  const checkoutId = cb?.CheckoutRequestID;
  if (!cb || !checkoutId) return NextResponse.json({ ResultCode: 1, ResultDesc: "No stkCallback" }, { status: 400 });

  const inv = await prisma.platformInvoice.findFirst({ where: { checkoutRequestId: checkoutId, status: "open" } });
  if (!inv) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

  if (cb.ResultCode !== 0) {
    // Leave the invoice open so the landlord can retry.
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  const items = cb.CallbackMetadata?.Item ?? [];
  const receipt = String(items.find((i) => i.Name === "MpesaReceiptNumber")?.Value || `KEJA${Date.now()}`);

  await prisma.platformInvoice.update({
    where: { id: inv.id },
    data: { status: "paid", paidAt: new Date(), mpesaReceipt: receipt },
  });
  await prisma.landlord.update({ where: { id: inv.landlordId }, data: { billingStatus: "active" } });

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
