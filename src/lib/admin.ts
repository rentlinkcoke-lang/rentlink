// Platform super-admin data layer. All functions assume the caller is a super
// admin (gate routes with requireSuperAdmin / the /admin layout).

import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { getCurrentLandlord } from "./auth";
import { monthlyCharge } from "./platform-billing";

// Route guard: only super admins pass. Others are bounced.
export async function requireSuperAdmin() {
  const me = await getCurrentLandlord();
  if (!me) redirect("/login");
  if (!me.isSuperAdmin) redirect("/dashboard");
  return me;
}

function monthRange(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start, end };
}

export interface PlatformOverview {
  landlords: number;
  suspended: number;
  byStatus: { trialing: number; active: number; past_due: number; canceled: number };
  units: number;
  tenants: number;
  mrr: number;
  collectedThisMonth: number;
  arrears: number;
  unmatched: number;
}

export async function platformOverview(): Promise<PlatformOverview> {
  // Exclude super-admin accounts from landlord metrics.
  const landlords = await prisma.landlord.findMany({
    where: { isSuperAdmin: false },
    select: { id: true, billingStatus: true, suspended: true },
  });

  const byStatus = { trialing: 0, active: 0, past_due: 0, canceled: 0 } as Record<string, number>;
  let suspended = 0;
  for (const l of landlords) {
    byStatus[l.billingStatus] = (byStatus[l.billingStatus] ?? 0) + 1;
    if (l.suspended) suspended += 1;
  }

  // Units per landlord → total units + MRR.
  let units = 0;
  let mrr = 0;
  for (const l of landlords) {
    const c = await prisma.unit.count({ where: { property: { landlordId: l.id } } });
    units += c;
    mrr += monthlyCharge(c);
  }

  const tenants = await prisma.tenant.count({ where: { landlord: { isSuperAdmin: false } } });

  const { start, end } = monthRange();
  const allocs = await prisma.allocation.findMany({
    where: { payment: { receivedAt: { gte: start, lt: end }, landlord: { isSuperAdmin: false } } },
    select: { amount: true },
  });
  const collectedThisMonth = allocs.reduce((s, a) => s + a.amount, 0);

  const open = await prisma.invoice.findMany({
    where: { status: { in: ["pending", "partial", "overdue"] }, lease: { unit: { property: { landlord: { isSuperAdmin: false } } } } },
    select: { amount: true, amountPaid: true },
  });
  const arrears = open.reduce((s, i) => s + (i.amount - i.amountPaid), 0);

  const unmatched = await prisma.payment.count({ where: { status: "unmatched", landlord: { isSuperAdmin: false } } });

  return {
    landlords: landlords.length,
    suspended,
    byStatus: { trialing: byStatus.trialing || 0, active: byStatus.active || 0, past_due: byStatus.past_due || 0, canceled: byStatus.canceled || 0 },
    units,
    tenants,
    mrr,
    collectedThisMonth,
    arrears,
    unmatched,
  };
}

export interface AdminLandlordRow {
  id: string;
  name: string;
  businessName: string | null;
  email: string;
  units: number;
  billingStatus: string;
  suspended: boolean;
  mrr: number;
  createdAt: Date;
}

export async function landlordsList(): Promise<AdminLandlordRow[]> {
  const landlords = await prisma.landlord.findMany({
    where: { isSuperAdmin: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, businessName: true, email: true, billingStatus: true, suspended: true, createdAt: true },
  });
  const rows: AdminLandlordRow[] = [];
  for (const l of landlords) {
    const units = await prisma.unit.count({ where: { property: { landlordId: l.id } } });
    rows.push({ ...l, units, mrr: monthlyCharge(units) });
  }
  return rows.sort((a, b) => b.mrr - a.mrr);
}

export async function landlordDetail(id: string) {
  const l = await prisma.landlord.findUnique({ where: { id } });
  if (!l || l.isSuperAdmin) return null;

  const [properties, units, tenants, activeLeases] = await Promise.all([
    prisma.property.count({ where: { landlordId: id } }),
    prisma.unit.count({ where: { property: { landlordId: id } } }),
    prisma.tenant.count({ where: { landlordId: id } }),
    prisma.lease.count({ where: { status: "active", unit: { property: { landlordId: id } } } }),
  ]);

  const { start, end } = monthRange();
  const allocs = await prisma.allocation.findMany({
    where: { payment: { landlordId: id, receivedAt: { gte: start, lt: end } } },
    select: { amount: true },
  });
  const collectedThisMonth = allocs.reduce((s, a) => s + a.amount, 0);

  const open = await prisma.invoice.findMany({
    where: { status: { in: ["pending", "partial", "overdue"] }, lease: { unit: { property: { landlordId: id } } } },
    select: { amount: true, amountPaid: true },
  });
  const arrears = open.reduce((s, i) => s + (i.amount - i.amountPaid), 0);

  const invoices = await prisma.platformInvoice.findMany({
    where: { landlordId: id },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    take: 6,
  });

  return {
    landlord: l,
    counts: { properties, units, tenants, activeLeases, occupancy: units ? Math.round((activeLeases / units) * 100) : 0 },
    collectedThisMonth,
    arrears,
    mrr: monthlyCharge(units),
    invoices,
  };
}
