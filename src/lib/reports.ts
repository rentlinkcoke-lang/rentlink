// Financial reporting — cash-basis P&L built from reconciled income and expenses.
//
// Income is attributed to a property via payment allocations (money actually
// applied to that property's invoices in the period). Expenses come from the
// Expense ledger. Net = income − expenses, per property and across the portfolio.

import { prisma } from "./prisma";

export interface PropertyPnl {
  id: string;
  name: string;
  rent: number;
  utilities: number;
  income: number;
  expenses: number;
  net: number;
}

export interface Pnl {
  year: number;
  month: number;
  properties: PropertyPnl[];
  totals: { rent: number; utilities: number; income: number; expenses: number; net: number };
  expenseByCategory: Record<string, number>;
}

export async function profitAndLoss(landlordId: string, year: number, month: number): Promise<Pnl> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const properties = await prisma.property.findMany({
    where: { landlordId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Income: allocations whose payment landed in the period.
  const allocations = await prisma.allocation.findMany({
    where: { payment: { landlordId, receivedAt: { gte: start, lt: end } } },
    include: { invoice: { include: { lease: { include: { unit: { select: { propertyId: true } } } } } } },
  });

  // Expenses in the period.
  const expenses = await prisma.expense.findMany({
    where: { property: { landlordId }, incurredAt: { gte: start, lt: end } },
    select: { propertyId: true, category: true, amount: true },
  });

  const byProp = new Map<string, PropertyPnl>();
  for (const p of properties) {
    byProp.set(p.id, { id: p.id, name: p.name, rent: 0, utilities: 0, income: 0, expenses: 0, net: 0 });
  }

  for (const a of allocations) {
    const propId = a.invoice.lease.unit.propertyId;
    const row = byProp.get(propId);
    if (!row) continue;
    if (a.invoice.type === "rent") row.rent += a.amount;
    else row.utilities += a.amount;
    row.income += a.amount;
  }

  const expenseByCategory: Record<string, number> = {};
  for (const e of expenses) {
    const row = byProp.get(e.propertyId);
    if (row) row.expenses += e.amount;
    expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount;
  }

  const rows = [...byProp.values()];
  for (const r of rows) r.net = r.income - r.expenses;

  const totals = rows.reduce(
    (t, r) => ({
      rent: t.rent + r.rent,
      utilities: t.utilities + r.utilities,
      income: t.income + r.income,
      expenses: t.expenses + r.expenses,
      net: t.net + r.net,
    }),
    { rent: 0, utilities: 0, income: 0, expenses: 0, net: 0 }
  );

  return { year, month, properties: rows, totals, expenseByCategory };
}

export function pnlToCsv(pnl: Pnl): string {
  const rows: string[][] = [];
  rows.push(["Property", "Rent collected", "Utilities collected", "Total income", "Expenses", "Net"]);
  for (const p of pnl.properties) {
    rows.push([p.name, String(p.rent), String(p.utilities), String(p.income), String(p.expenses), String(p.net)]);
  }
  rows.push(["TOTAL", String(pnl.totals.rent), String(pnl.totals.utilities), String(pnl.totals.income), String(pnl.totals.expenses), String(pnl.totals.net)]);
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
}
