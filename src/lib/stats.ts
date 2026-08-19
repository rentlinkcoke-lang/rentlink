// Dashboard aggregate queries.

import { prisma } from "./prisma";

export async function dashboardStats(landlordId: string, year: number, month: number) {
  const properties = await prisma.property.count({ where: { landlordId } });

  const units = await prisma.unit.findMany({
    where: { property: { landlordId } },
    include: { leases: { where: { status: "active" }, select: { id: true } } },
  });
  const totalUnits = units.length;
  const occupied = units.filter((u) => u.leases.length > 0).length;
  const occupancy = totalUnits ? Math.round((occupied / totalUnits) * 100) : 0;

  // Billed vs collected this month.
  const monthInvoices = await prisma.invoice.findMany({
    where: {
      periodYear: year,
      periodMonth: month,
      lease: { unit: { property: { landlordId } } },
    },
    select: { amount: true, amountPaid: true },
  });
  const billedThisMonth = monthInvoices.reduce((s, i) => s + i.amount, 0);
  const collectedThisMonth = monthInvoices.reduce((s, i) => s + i.amountPaid, 0);
  const collectionRate = billedThisMonth
    ? Math.round((collectedThisMonth / billedThisMonth) * 100)
    : 0;

  // Total arrears across all open invoices.
  const openInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["pending", "partial", "overdue"] },
      lease: { unit: { property: { landlordId } } },
    },
    select: { amount: true, amountPaid: true },
  });
  const arrears = openInvoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0);

  // Suspense: unmatched payments waiting for a human.
  const unmatched = await prisma.payment.aggregate({
    where: { landlordId, status: "unmatched" },
    _count: true,
    _sum: { amount: true },
  });

  return {
    properties,
    totalUnits,
    occupied,
    vacant: totalUnits - occupied,
    occupancy,
    billedThisMonth,
    collectedThisMonth,
    collectionRate,
    arrears,
    unmatchedCount: unmatched._count,
    unmatchedAmount: unmatched._sum.amount ?? 0,
  };
}

// Tenants whose lease has an outstanding balance, worst first.
export async function arrearsList(landlordId: string) {
  const leases = await prisma.lease.findMany({
    where: { status: "active", unit: { property: { landlordId } } },
    include: {
      tenant: true,
      unit: { include: { property: true } },
      invoices: {
        where: { status: { in: ["pending", "partial", "overdue"] } },
        select: { amount: true, amountPaid: true, periodYear: true, periodMonth: true },
      },
    },
  });

  return leases
    .map((l) => {
      const balance = l.invoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0);
      const months = l.invoices.length;
      return {
        leaseId: l.id,
        tenant: l.tenant.name,
        phone: l.tenant.phone,
        unit: `${l.unit.property.name} ${l.unit.label}`,
        balance,
        months,
      };
    })
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance);
}
