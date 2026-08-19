// Portfolio analytics — the growth-facing numbers built from reconciled data.

import { prisma } from "./prisma";
import { monthName } from "./format";

export interface TrendPoint {
  year: number;
  month: number;
  label: string;
  billed: number;
  collected: number;
  rate: number;
  current: boolean;
}

// Billed vs collected per month (accrual: by invoice period), last N months.
export async function monthlyTrend(landlordId: string, months = 6): Promise<TrendPoint[]> {
  const now = new Date();
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth() + 1;
  let y = curY;
  let m = curM;
  const periods: { y: number; m: number }[] = [];
  for (let i = 0; i < months; i++) {
    periods.unshift({ y, m });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }

  const out: TrendPoint[] = [];
  for (const p of periods) {
    const invs = await prisma.invoice.findMany({
      where: { periodYear: p.y, periodMonth: p.m, lease: { unit: { property: { landlordId } } } },
      select: { amount: true, amountPaid: true },
    });
    const billed = invs.reduce((s, i) => s + i.amount, 0);
    const collected = invs.reduce((s, i) => s + i.amountPaid, 0);
    out.push({
      year: p.y, month: p.m, label: monthName(p.m).slice(0, 3),
      billed, collected, rate: billed ? Math.round((collected / billed) * 100) : 0,
      current: p.y === curY && p.m === curM,
    });
  }
  return out;
}

export interface AgingBucket { label: string; amount: number }

// Outstanding balances bucketed by how far past due they are.
export async function arrearsAging(landlordId: string): Promise<{ buckets: AgingBucket[]; total: number }> {
  const invs = await prisma.invoice.findMany({
    where: { status: { in: ["pending", "partial", "overdue"] }, lease: { unit: { property: { landlordId } } } },
    select: { amount: true, amountPaid: true, dueDate: true },
  });
  const now = Date.now();
  const b = { notDue: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
  for (const i of invs) {
    const out = i.amount - i.amountPaid;
    if (out <= 0) continue;
    const days = Math.floor((now - i.dueDate.getTime()) / 86_400_000);
    if (days <= 0) b.notDue += out;
    else if (days <= 30) b.d30 += out;
    else if (days <= 60) b.d60 += out;
    else if (days <= 90) b.d90 += out;
    else b.d90plus += out;
  }
  const buckets: AgingBucket[] = [
    { label: "Not due", amount: b.notDue },
    { label: "1–30d", amount: b.d30 },
    { label: "31–60d", amount: b.d60 },
    { label: "61–90d", amount: b.d90 },
    { label: "90d+", amount: b.d90plus },
  ];
  return { buckets, total: buckets.reduce((s, x) => s + x.amount, 0) };
}

export interface PropOccupancy { name: string; total: number; occupied: number; pct: number }

export async function occupancyBreakdown(landlordId: string) {
  const props = await prisma.property.findMany({
    where: { landlordId },
    orderBy: { name: "asc" },
    include: { units: { include: { leases: { where: { status: "active" }, select: { id: true } } } } },
  });
  let totalUnits = 0;
  let occupied = 0;
  let vacancyLoss = 0;
  const perProperty: PropOccupancy[] = [];
  for (const p of props) {
    const total = p.units.length;
    const occ = p.units.filter((u) => u.leases.length > 0).length;
    totalUnits += total;
    occupied += occ;
    for (const u of p.units) if (u.leases.length === 0) vacancyLoss += u.rent;
    perProperty.push({ name: p.name, total, occupied: occ, pct: total ? Math.round((occ / total) * 100) : 0 });
  }
  return {
    totalUnits,
    occupied,
    vacant: totalUnits - occupied,
    occupancyPct: totalUnits ? Math.round((occupied / totalUnits) * 100) : 0,
    vacancyLoss,
    perProperty,
  };
}
