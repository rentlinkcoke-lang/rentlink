// Invoice generation & arrears helpers.

import { prisma } from "./prisma";
import { sendSms, sendEmail, sendWhatsApp } from "./notify";
import { smsInvoice, smsReminder } from "./messages";
import { emailInvoice, emailReminder } from "./email-templates";
import { waInvoice, waReminder } from "./whatsapp-templates";

// Generate a rent invoice for a lease for a given month, if one doesn't exist.
// Due on the 5th of the month by convention.
export async function ensureRentInvoice(leaseId: string, year: number, month: number) {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
  if (!lease || lease.status !== "active") return null;

  const existing = await prisma.invoice.findFirst({
    where: { leaseId, periodYear: year, periodMonth: month, type: "rent" },
  });
  if (existing) return existing;

  const dueDate = new Date(Date.UTC(year, month - 1, 5));
  const overdue = dueDate.getTime() < Date.now();

  return prisma.invoice.create({
    data: {
      leaseId,
      periodYear: year,
      periodMonth: month,
      type: "rent",
      amount: lease.rent,
      dueDate,
      status: overdue ? "overdue" : "pending",
    },
  });
}

// Run rent billing for every active lease belonging to a landlord for a month.
// Returns the ids of the invoices actually created (so we only notify new ones).
export async function runMonthlyRent(landlordId: string, year: number, month: number) {
  const leases = await prisma.lease.findMany({
    where: { status: "active", unit: { property: { landlordId } } },
    select: { id: true },
  });
  const createdIds: string[] = [];
  for (const l of leases) {
    const before = await prisma.invoice.findFirst({
      where: { leaseId: l.id, periodYear: year, periodMonth: month, type: "rent" },
    });
    if (!before) {
      const inv = await ensureRentInvoice(l.id, year, month);
      if (inv) createdIds.push(inv.id);
    }
  }
  return { created: createdIds.length, createdIds, leases: leases.length };
}

// Send an SMS invoice notice for each of the given invoices.
export async function notifyInvoices(landlordId: string, invoiceIds: string[]) {
  if (invoiceIds.length === 0) return 0;
  const landlord = await prisma.landlord.findUnique({
    where: { id: landlordId },
    select: { businessName: true, name: true, paybill: true, smsSenderId: true, smsOn: true, whatsappOn: true, emailOn: true },
  });
  const business = landlord?.businessName || landlord?.name || "RentLink";
  const paybill = landlord?.paybill || "4109210";

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: invoiceIds } },
    include: { lease: { include: { tenant: true, unit: { include: { property: true } } } } },
  });

  for (const inv of invoices) {
    const t = inv.lease.tenant;
    const u = inv.lease.unit;
    if (landlord?.smsOn) {
      await sendSms({
        landlordId,
        toPhone: t.phone,
        toName: t.name,
        kind: "invoice",
        senderId: landlord?.smsSenderId || undefined,
        tenantId: inv.lease.tenantId,
        invoiceId: inv.id,
        body: smsInvoice({
          tenantName: t.name,
          propertyName: u.property.name,
          unitLabel: u.label,
          amount: inv.amount,
          year: inv.periodYear,
          month: inv.periodMonth,
          paybill,
          payRef: u.payRef,
          business,
        }),
      });
    }
    if (landlord?.whatsappOn) {
      const wa = waInvoice({
        tenantName: t.name,
        propertyName: u.property.name,
        unitLabel: u.label,
        amount: inv.amount,
        year: inv.periodYear,
        month: inv.periodMonth,
        paybill,
        payRef: u.payRef,
        business,
      });
      await sendWhatsApp({
        landlordId,
        toPhone: t.phone,
        toName: t.name,
        kind: "invoice",
        tenantId: inv.lease.tenantId,
        invoiceId: inv.id,
        ...wa,
      });
    }
    if (landlord?.emailOn && t.email) {
      const mail = emailInvoice({
        tenantName: t.name,
        propertyName: u.property.name,
        unitLabel: u.label,
        amount: inv.amount,
        year: inv.periodYear,
        month: inv.periodMonth,
        paybill,
        payRef: u.payRef,
        business,
      });
      await sendEmail({
        landlordId,
        toEmail: t.email,
        toName: t.name,
        kind: "invoice",
        tenantId: inv.lease.tenantId,
        invoiceId: inv.id,
        ...mail,
      });
    }
  }
  return invoices.length;
}

// Send an SMS arrears reminder to a single lease (if it has a balance).
export async function sendLeaseReminder(landlordId: string, leaseId: string) {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, status: "active", unit: { property: { landlordId } } },
    include: {
      tenant: true,
      unit: { include: { property: true } },
      invoices: { where: { status: { in: ["pending", "partial", "overdue"] } }, select: { amount: true, amountPaid: true } },
    },
  });
  if (!lease) return null;
  const balance = lease.invoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0);
  if (balance <= 0) return null;

  const landlord = await prisma.landlord.findUnique({
    where: { id: landlordId },
    select: { businessName: true, name: true, paybill: true, smsSenderId: true, smsOn: true, whatsappOn: true, emailOn: true },
  });
  const business = landlord?.businessName || landlord?.name || "RentLink";
  const paybill = landlord?.paybill || "4109210";
  const t = lease.tenant;
  const u = lease.unit;

  if (landlord?.smsOn) {
    await sendSms({
      landlordId,
      toPhone: t.phone,
      toName: t.name,
      kind: "reminder",
      senderId: landlord?.smsSenderId || undefined,
      tenantId: lease.tenantId,
      body: smsReminder({
        tenantName: t.name,
        propertyName: u.property.name,
        unitLabel: u.label,
        balance,
        paybill,
        payRef: u.payRef,
        business,
      }),
    });
  }

  if (landlord?.whatsappOn) {
    const wa = waReminder({
      tenantName: t.name,
      propertyName: u.property.name,
      unitLabel: u.label,
      balance,
      paybill,
      payRef: u.payRef,
      business,
    });
    await sendWhatsApp({
      landlordId,
      toPhone: t.phone,
      toName: t.name,
      kind: "reminder",
      tenantId: lease.tenantId,
      ...wa,
    });
  }

  if (landlord?.emailOn && t.email) {
    const mail = emailReminder({
      tenantName: t.name,
      propertyName: u.property.name,
      unitLabel: u.label,
      balance,
      paybill,
      payRef: u.payRef,
      business,
    });
    await sendEmail({
      landlordId,
      toEmail: t.email,
      toName: t.name,
      kind: "reminder",
      tenantId: lease.tenantId,
      ...mail,
    });
  }

  return { sent: true, balance };
}

// Add a utility (water/electricity) charge to a lease's current month.
export async function addUtilityCharge(
  leaseId: string,
  type: "water" | "electricity" | "other",
  amount: number,
  year: number,
  month: number
) {
  const dueDate = new Date(Date.UTC(year, month - 1, 5));
  return prisma.invoice.create({
    data: {
      leaseId,
      periodYear: year,
      periodMonth: month,
      type,
      amount,
      dueDate,
      status: dueDate.getTime() < Date.now() ? "overdue" : "pending",
    },
  });
}

// Mark pending invoices past their due date as overdue. Cheap to run on load.
export async function sweepOverdue(landlordId: string) {
  await prisma.invoice.updateMany({
    where: {
      status: "pending",
      dueDate: { lt: new Date() },
      lease: { unit: { property: { landlordId } } },
    },
    data: { status: "overdue" },
  });
}

// Total outstanding (billed - paid) for a lease.
export async function leaseBalance(leaseId: string): Promise<number> {
  const invs = await prisma.invoice.findMany({
    where: { leaseId, status: { in: ["pending", "partial", "overdue"] } },
    select: { amount: true, amountPaid: true },
  });
  return invs.reduce((sum, i) => sum + (i.amount - i.amountPaid), 0);
}
