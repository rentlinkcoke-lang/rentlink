// Shared collection logic — used by the "Request via M-Pesa" button AND the
// WhatsApp pay-in-chat bot. Initiates an STK Push against the landlord's own
// paybill (Model A), or simulates the round-trip in dry-run.

import { prisma } from "./prisma";
import { resolveCreds, stkPush } from "./daraja";
import { reconcilePayment } from "./reconcile";

const APP_BASE = process.env.APP_BASE_URL || "http://localhost:3000";

export interface StkOutcome {
  ok: boolean;
  amount?: number;
  unitLabel?: string;
  simulated?: boolean;
  error?: string;
}

export async function initiateStkForLease(landlordId: string, leaseId: string): Promise<StkOutcome> {
  const landlord = await prisma.landlord.findUnique({ where: { id: landlordId } });
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, status: "active", unit: { property: { landlordId } } },
    include: {
      tenant: true,
      unit: { include: { property: true } },
      invoices: { where: { status: { in: ["pending", "partial", "overdue"] } }, select: { amount: true, amountPaid: true } },
    },
  });
  if (!landlord || !lease) return { ok: false, error: "No active lease found." };

  const balance = lease.invoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0);
  const amount = balance > 0 ? balance : lease.rent;
  if (amount <= 0) return { ok: false, error: "Nothing is due right now." };

  const stk = await prisma.stkRequest.create({
    data: {
      landlordId,
      leaseId: lease.id,
      unitPayRef: lease.unit.payRef,
      tenantName: lease.tenant.name,
      tenantPhone: lease.tenant.phone,
      amount,
      status: "pending",
    },
  });

  const creds = resolveCreds(landlord);
  if (!creds) {
    // Dry-run: simulate the tenant approving the prompt, then reconcile.
    const receipt = "STKSIM" + Date.now().toString(36).toUpperCase().slice(-6);
    await prisma.stkRequest.update({
      where: { id: stk.id },
      data: { status: "simulated", mpesaReceipt: receipt, resultDesc: "Simulated — connect a paybill to send real prompts." },
    });
    await reconcilePayment({
      landlordId,
      mpesaCode: receipt,
      amount,
      payRef: lease.unit.payRef,
      payerPhone: lease.tenant.phone,
      payerName: lease.tenant.name,
      raw: JSON.stringify({ simulatedStk: true }),
    });
    return { ok: true, amount, unitLabel: lease.unit.label, simulated: true };
  }

  const res = await stkPush(creds, {
    phone: lease.tenant.phone,
    amount,
    accountRef: lease.unit.payRef,
    description: "Rent",
    callbackUrl: `${APP_BASE}/api/mpesa/stk/callback`,
  });
  await prisma.stkRequest.update({
    where: { id: stk.id },
    data: res.ok
      ? { checkoutRequestId: res.checkoutRequestId, merchantRequestId: res.merchantRequestId, status: "pending" }
      : { status: "failed", resultDesc: res.error },
  });
  return res.ok ? { ok: true, amount, unitLabel: lease.unit.label } : { ok: false, error: res.error };
}
