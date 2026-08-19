// Safaricom STK Push result callback. Correlates the async result to the
// StkRequest we raised (by CheckoutRequestID) and, on success, runs it through
// the same reconciliation engine as a walk-in C2B payment.
//
//   POST /api/mpesa/stk/callback

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reconcilePayment } from "@/lib/reconcile";

interface StkCallbackBody {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
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
  if (!cb || !checkoutId) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "No stkCallback" }, { status: 400 });
  }

  const stk = await prisma.stkRequest.findFirst({ where: { checkoutRequestId: checkoutId } });
  // Always ACK Safaricom so it stops retrying, even if we can't match it.
  if (!stk) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

  // Failure / cancellation.
  if (cb.ResultCode !== 0) {
    await prisma.stkRequest.update({
      where: { id: stk.id },
      data: { status: "failed", resultCode: String(cb.ResultCode ?? ""), resultDesc: cb.ResultDesc },
    });
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  // Success — pull the metadata items.
  const items = cb.CallbackMetadata?.Item ?? [];
  const get = (name: string) => items.find((i) => i.Name === name)?.Value;
  const amount = Math.round(Number(get("Amount")) || stk.amount);
  const receipt = String(get("MpesaReceiptNumber") || `STK${Date.now()}`);
  const phone = String(get("PhoneNumber") || stk.tenantPhone);

  await prisma.stkRequest.update({
    where: { id: stk.id },
    data: { status: "success", resultCode: "0", resultDesc: cb.ResultDesc, mpesaReceipt: receipt },
  });

  await reconcilePayment({
    landlordId: stk.landlordId,
    mpesaCode: receipt,
    amount,
    payRef: stk.unitPayRef,
    payerPhone: phone,
    payerName: stk.tenantName || undefined,
    raw: JSON.stringify(cb),
  });

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
