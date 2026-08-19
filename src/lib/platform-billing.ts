// RentLink's own subscription billing — the per-unit SaaS revenue model.
// Tiered, flat-bracket pricing that gets cheaper per unit as a landlord grows.

import { prisma } from "./prisma";
import type { DarajaCreds } from "./daraja";

export const TRIAL_DAYS = 14;

// Flat-bracket tiers: all units are priced at the rate of the bracket the total
// unit count falls into. Grows-with-you: bigger portfolios pay less per unit.
export const PRICE_TIERS: { upTo: number; rate: number; label: string }[] = [
  { upTo: 20, rate: 75, label: "1–20 units" },
  { upTo: 100, rate: 60, label: "21–100 units" },
  { upTo: Infinity, rate: 50, label: "100+ units" },
];

export function unitRate(units: number): number {
  for (const t of PRICE_TIERS) if (units <= t.upTo) return t.rate;
  return PRICE_TIERS[PRICE_TIERS.length - 1].rate;
}

export function monthlyCharge(units: number): number {
  return units * unitRate(units);
}

// Platform Daraja creds from env (plaintext — env is the secure store).
export function platformCreds(): DarajaCreds | null {
  const shortcode = process.env.PLATFORM_MPESA_SHORTCODE;
  const consumerKey = process.env.PLATFORM_DARAJA_CONSUMER_KEY;
  const consumerSecret = process.env.PLATFORM_DARAJA_CONSUMER_SECRET;
  const passkey = process.env.PLATFORM_DARAJA_PASSKEY;
  if (!shortcode || !consumerKey || !consumerSecret || !passkey) return null;
  return {
    shortcode,
    consumerKey,
    consumerSecret,
    passkey,
    env: process.env.PLATFORM_DARAJA_ENV === "production" ? "production" : "sandbox",
  };
}

export interface BillingSummary {
  unitCount: number;
  rate: number;
  amount: number;
  status: string;
  trialActive: boolean;
  trialDaysLeft: number;
  trialEndsAt: Date | null;
  openInvoice: { id: string; amount: number; periodYear: number; periodMonth: number } | null;
  dueNow: boolean;
}

export async function billingSummary(landlordId: string): Promise<BillingSummary> {
  const landlord = await prisma.landlord.findUniqueOrThrow({ where: { id: landlordId } });
  const unitCount = await prisma.unit.count({ where: { property: { landlordId } } });
  const rate = unitRate(unitCount);
  const amount = monthlyCharge(unitCount);

  const now = Date.now();
  const trialEndsAt = landlord.trialEndsAt;
  const trialActive = Boolean(landlord.billingStatus === "trialing" && trialEndsAt && trialEndsAt.getTime() > now);
  const trialDaysLeft = trialActive && trialEndsAt ? Math.ceil((trialEndsAt.getTime() - now) / 86_400_000) : 0;

  const open = await prisma.platformInvoice.findFirst({
    where: { landlordId, status: "open" },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });

  return {
    unitCount,
    rate,
    amount,
    status: landlord.billingStatus,
    trialActive,
    trialDaysLeft,
    trialEndsAt,
    openInvoice: open
      ? { id: open.id, amount: open.amount, periodYear: open.periodYear, periodMonth: open.periodMonth }
      : null,
    dueNow: Boolean(open && !trialActive),
  };
}

// Create (once) this landlord's platform invoice for a month.
export async function generatePlatformInvoice(landlordId: string, year: number, month: number) {
  const existing = await prisma.platformInvoice.findUnique({
    where: { landlordId_periodYear_periodMonth: { landlordId, periodYear: year, periodMonth: month } },
  });
  if (existing) return existing;

  const unitCount = await prisma.unit.count({ where: { property: { landlordId } } });
  if (unitCount === 0) return null;
  const rate = unitRate(unitCount);

  return prisma.platformInvoice.create({
    data: { landlordId, periodYear: year, periodMonth: month, unitCount, unitRate: rate, amount: unitCount * rate, status: "open" },
  });
}

// Bill every landlord whose trial has ended; flag past_due if they have an open bill.
export async function runPlatformBilling(year: number, month: number) {
  const landlords = await prisma.landlord.findMany({ select: { id: true, trialEndsAt: true, billingStatus: true } });
  let invoiced = 0;
  const now = Date.now();
  for (const l of landlords) {
    const trialOver = !l.trialEndsAt || l.trialEndsAt.getTime() <= now;
    if (!trialOver) continue;
    const inv = await generatePlatformInvoice(l.id, year, month);
    if (inv) invoiced += 1;
    const open = await prisma.platformInvoice.count({ where: { landlordId: l.id, status: "open" } });
    if (open > 0 && l.billingStatus !== "canceled") {
      await prisma.landlord.update({ where: { id: l.id }, data: { billingStatus: "past_due" } });
    }
  }
  return { landlords: landlords.length, invoiced };
}

// Platform-wide MRR estimate (what all landlords would owe this month).
export async function platformMrr(): Promise<{ landlords: number; units: number; mrr: number }> {
  const landlords = await prisma.landlord.findMany({ select: { id: true } });
  let units = 0;
  let mrr = 0;
  for (const l of landlords) {
    const c = await prisma.unit.count({ where: { property: { landlordId: l.id } } });
    units += c;
    mrr += monthlyCharge(c);
  }
  return { landlords: landlords.length, units, mrr };
}
