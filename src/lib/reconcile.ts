// The reconciliation engine.
//
// Given an incoming M-Pesa payment (payRef, amount, payer), it:
//   1. resolves the unit from the payment reference,
//   2. finds the active lease + tenant,
//   3. applies the money to outstanding invoices oldest-first,
//   4. leaves any remainder as tenant credit,
//   5. records everything as an auditable ledger, and
//   6. drafts the WhatsApp receipt.
//
// Payments that can't be resolved (unknown ref / vacant unit) land in "suspense"
// as unmatched, for the landlord to reconcile by hand.

import { prisma } from "./prisma";
import { periodLabel, kes } from "./format";
import { sendSms, sendEmail, sendWhatsApp } from "./notify";
import { smsReceipt } from "./messages";
import { emailReceipt } from "./email-templates";
import { waReceipt } from "./whatsapp-templates";

export interface IncomingPayment {
  landlordId: string;
  mpesaCode: string;
  amount: number;
  payRef: string;
  payerPhone: string;
  payerName?: string;
  raw?: string;
}

export interface ReconcileResult {
  paymentId: string;
  status: "matched" | "unmatched";
  duplicate: boolean;
  unitLabel?: string;
  propertyName?: string;
  tenantName?: string;
  tenantPhone?: string;
  allocated: { period: string; type: string; amount: number }[];
  credit: number;
  receiptBody?: string;
  reason?: string;
}

export async function reconcilePayment(input: IncomingPayment): Promise<ReconcileResult> {
  // Idempotency: M-Pesa may re-deliver the confirmation. mpesaCode is unique.
  const existing = await prisma.payment.findUnique({
    where: { mpesaCode: input.mpesaCode },
    include: { allocations: { include: { invoice: true } } },
  });
  if (existing) {
    return {
      paymentId: existing.id,
      status: existing.status === "matched" ? "matched" : "unmatched",
      duplicate: true,
      credit: existing.amountUnallocated,
      allocated: existing.allocations.map((a) => ({
        period: periodLabel(a.invoice.periodYear, a.invoice.periodMonth),
        type: a.invoice.type,
        amount: a.amount,
      })),
      reason: "Duplicate M-Pesa code — already processed.",
    };
  }

  const ref = input.payRef.trim().toUpperCase().replace(/\s+/g, "");

  // Resolve the unit from the reference.
  const unit = await prisma.unit.findUnique({
    where: { payRef: ref },
    include: {
      property: true,
      leases: {
        where: { status: "active" },
        include: { tenant: true },
        orderBy: { startDate: "desc" },
        take: 1,
      },
    },
  });

  const lease = unit?.leases[0];

  // Unresolvable → record as unmatched suspense.
  if (!unit || !lease) {
    const payment = await prisma.payment.create({
      data: {
        landlordId: input.landlordId,
        mpesaCode: input.mpesaCode,
        amount: input.amount,
        amountUnallocated: input.amount,
        payRef: ref,
        payerPhone: input.payerPhone,
        payerName: input.payerName,
        status: "unmatched",
        raw: input.raw,
      },
    });
    return {
      paymentId: payment.id,
      status: "unmatched",
      duplicate: false,
      credit: input.amount,
      allocated: [],
      reason: !unit
        ? `No unit uses reference "${ref}".`
        : `${unit.property.name} ${unit.label} has no active tenant.`,
    };
  }

  // Outstanding invoices, oldest first.
  const invoices = await prisma.invoice.findMany({
    where: { leaseId: lease.id, status: { in: ["pending", "partial", "overdue"] } },
    orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }, { type: "asc" }],
  });

  let remaining = input.amount;
  const allocationsToCreate: { invoiceId: string; amount: number }[] = [];
  const allocatedSummary: { period: string; type: string; amount: number }[] = [];

  for (const inv of invoices) {
    if (remaining <= 0) break;
    const due = inv.amount - inv.amountPaid;
    if (due <= 0) continue;
    const applied = Math.min(due, remaining);
    remaining -= applied;
    allocationsToCreate.push({ invoiceId: inv.id, amount: applied });
    allocatedSummary.push({
      period: periodLabel(inv.periodYear, inv.periodMonth),
      type: inv.type,
      amount: applied,
    });
  }

  // Persist everything atomically.
  const payment = await prisma.$transaction(async (tx) => {
    const pay = await tx.payment.create({
      data: {
        landlordId: input.landlordId,
        mpesaCode: input.mpesaCode,
        amount: input.amount,
        amountUnallocated: remaining,
        payRef: ref,
        payerPhone: input.payerPhone,
        payerName: input.payerName ?? lease.tenant.name,
        status: "matched",
        raw: input.raw,
      },
    });

    for (const alloc of allocationsToCreate) {
      await tx.allocation.create({
        data: { paymentId: pay.id, invoiceId: alloc.invoiceId, amount: alloc.amount },
      });
      const inv = invoices.find((i) => i.id === alloc.invoiceId)!;
      const newPaid = inv.amountPaid + alloc.amount;
      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          amountPaid: newPaid,
          status: newPaid >= inv.amount ? "paid" : "partial",
        },
      });
    }
    return pay;
  });

  const landlord = await prisma.landlord.findUnique({
    where: { id: input.landlordId },
    select: { businessName: true, name: true, smsSenderId: true, smsOn: true, whatsappOn: true, emailOn: true },
  });
  const business = landlord?.businessName || landlord?.name || "RentLink";

  const receiptBody = buildReceipt({
    tenantName: lease.tenant.name,
    propertyName: unit.property.name,
    unitLabel: unit.label,
    amount: input.amount,
    mpesaCode: input.mpesaCode,
    allocated: allocatedSummary,
    credit: remaining,
    businessName: business,
  });

  await prisma.receipt.create({
    data: {
      paymentId: payment.id,
      channel: "whatsapp",
      toPhone: lease.tenant.phone,
      body: receiptBody,
    },
  });

  // Remaining balance on this lease after applying the payment.
  const openInvoices = await prisma.invoice.findMany({
    where: { leaseId: lease.id, status: { in: ["pending", "partial", "overdue"] } },
    select: { amount: true, amountPaid: true },
  });
  const balance = openInvoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0);

  // Fire the SMS receipt (dry-run-safe; never blocks reconciliation).
  if (landlord?.smsOn) {
    await sendSms({
      landlordId: input.landlordId,
      toPhone: lease.tenant.phone,
      toName: lease.tenant.name,
      kind: "receipt",
      senderId: landlord?.smsSenderId || undefined,
      tenantId: lease.tenantId,
      paymentId: payment.id,
      body: smsReceipt({
        tenantName: lease.tenant.name,
        propertyName: unit.property.name,
        unitLabel: unit.label,
        amount: input.amount,
        balance,
        mpesaCode: input.mpesaCode,
        business,
      }),
    });
  }

  // WhatsApp receipt (template message).
  if (landlord?.whatsappOn) {
    const wa = waReceipt({
      tenantName: lease.tenant.name,
      propertyName: unit.property.name,
      unitLabel: unit.label,
      amount: input.amount,
      balance,
      mpesaCode: input.mpesaCode,
      business,
    });
    await sendWhatsApp({
      landlordId: input.landlordId,
      toPhone: lease.tenant.phone,
      toName: lease.tenant.name,
      kind: "receipt",
      tenantId: lease.tenantId,
      paymentId: payment.id,
      ...wa,
    });
  }

  // And the email receipt, when we have an address on file.
  if (landlord?.emailOn && lease.tenant.email) {
    const mail = emailReceipt({
      tenantName: lease.tenant.name,
      propertyName: unit.property.name,
      unitLabel: unit.label,
      amount: input.amount,
      balance,
      mpesaCode: input.mpesaCode,
      allocated: allocatedSummary,
      business,
    });
    await sendEmail({
      landlordId: input.landlordId,
      toEmail: lease.tenant.email,
      toName: lease.tenant.name,
      kind: "receipt",
      tenantId: lease.tenantId,
      paymentId: payment.id,
      ...mail,
    });
  }

  return {
    paymentId: payment.id,
    status: "matched",
    duplicate: false,
    unitLabel: unit.label,
    propertyName: unit.property.name,
    tenantName: lease.tenant.name,
    tenantPhone: lease.tenant.phone,
    allocated: allocatedSummary,
    credit: remaining,
    receiptBody,
  };
}

export function buildReceipt(args: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  amount: number;
  mpesaCode: string;
  allocated: { period: string; type: string; amount: number }[];
  credit: number;
  businessName?: string;
}): string {
  const lines: string[] = [];
  lines.push(`✅ Payment received — ${kes(args.amount)}`);
  lines.push("");
  lines.push(`Hi ${args.tenantName.split(" ")[0]}, we've received your payment for ${args.propertyName} ${args.unitLabel}.`);
  lines.push("");
  if (args.allocated.length) {
    lines.push("Applied to:");
    for (const a of args.allocated) {
      const label = a.type === "rent" ? "Rent" : a.type.charAt(0).toUpperCase() + a.type.slice(1);
      lines.push(`• ${a.period} ${label} — ${kes(a.amount)}`);
    }
  }
  if (args.credit > 0) {
    lines.push(`• Credit on account — ${kes(args.credit)}`);
  }
  lines.push("");
  lines.push(`Ref: ${args.mpesaCode}`);
  lines.push(`— ${args.businessName ?? "RentLink"}`);
  return lines.join("\n");
}
