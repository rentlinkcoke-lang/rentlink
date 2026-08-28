"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireLandlord } from "@/lib/auth";
import { generateUniquePayRef } from "@/lib/payref";
import { reconcilePayment } from "@/lib/reconcile";
import { ensureRentInvoice, runMonthlyRent, addUtilityCharge, notifyInvoices, sendLeaseReminder } from "@/lib/invoices";
import { arrearsList } from "@/lib/stats";
import { encrypt } from "@/lib/crypto";
import { resolveCreds, registerC2B } from "@/lib/daraja";
import { initiateStkForLease } from "@/lib/collections";
import { handleInboundWhatsApp } from "@/lib/chatbot";
import { stkPush } from "@/lib/daraja";
import { platformCreds } from "@/lib/platform-billing";
import { assignTenantToUnit } from "@/lib/leasing";
import { normalizeKenyanPhone, validKenyanPhone } from "@/lib/phone";
import { planImport, commitImport } from "@/lib/import";
import { createInvite, revokeInvite } from "@/lib/invites";

function code(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "PROP";
}

export async function createProperty(formData: FormData) {
  const landlord = await requireLandlord();
  const name = String(formData.get("name") || "").trim();
  const location = String(formData.get("location") || "").trim();
  if (!name) return;

  // Derive a unique property code within this landlord.
  let base = code(name);
  let c = base;
  let n = 1;
  while (await prisma.property.findUnique({ where: { landlordId_code: { landlordId: landlord.id, code: c } } })) {
    n += 1;
    c = `${base}${n}`;
  }

  await prisma.property.create({
    data: { landlordId: landlord.id, name, location: location || null, code: c },
  });
  revalidatePath("/dashboard/properties");
}

export async function createUnit(formData: FormData) {
  const landlord = await requireLandlord();
  const propertyId = String(formData.get("propertyId") || "");
  const label = String(formData.get("label") || "").trim();
  const rent = Math.round(Number(formData.get("rent")) || 0);
  const bedrooms = formData.get("bedrooms") ? Math.round(Number(formData.get("bedrooms"))) : null;

  const property = await prisma.property.findFirst({ where: { id: propertyId, landlordId: landlord.id } });
  if (!property || !label || rent <= 0) return;

  const payRef = await generateUniquePayRef(property.code, label);
  await prisma.unit.create({
    data: { propertyId, label, rent, bedrooms, payRef },
  });
  revalidatePath(`/dashboard/properties/${propertyId}`);
}

// Edit a unit's label / rent / bedrooms. The M-Pesa reference (payRef) is left
// unchanged even if the label changes — tenants already pay to that reference.
export async function updateUnit(
  _prev: unknown,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const landlord = await requireLandlord();
  const unitId = String(formData.get("unitId") || "");
  const label = String(formData.get("label") || "").trim();
  const rent = Math.round(Number(formData.get("rent")) || 0);
  const bdRaw = formData.get("bedrooms");
  const bedrooms = bdRaw !== null && String(bdRaw).trim() !== "" ? Math.round(Number(bdRaw)) : null;

  const unit = await prisma.unit.findFirst({ where: { id: unitId, property: { landlordId: landlord.id } } });
  if (!unit) return { error: "Unit not found." };
  if (!label) return { error: "Unit label is required." };
  if (rent <= 0) return { error: "Enter a valid rent." };
  if (label !== unit.label) {
    const clash = await prisma.unit.findFirst({ where: { propertyId: unit.propertyId, label, id: { not: unit.id } } });
    if (clash) return { error: `Another unit is already labelled "${label}".` };
  }

  await prisma.unit.update({
    where: { id: unit.id },
    data: { label, rent, bedrooms: bedrooms !== null && bedrooms >= 0 ? bedrooms : null },
  });
  revalidatePath(`/dashboard/properties/${unit.propertyId}`);
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Guarded delete for a unit: blocked when it has an active tenant or recorded
// M-Pesa payments; otherwise deletes (cascading its ended leases/invoices).
export async function deleteUnit(unitId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const landlord = await requireLandlord();
  const unit = await prisma.unit.findFirst({ where: { id: unitId, property: { landlordId: landlord.id } } });
  if (!unit) return { ok: false, error: "Unit not found." };

  const active = await prisma.lease.count({ where: { status: "active", unitId } });
  if (active > 0) return { ok: false, error: "This unit has an active tenant. End the lease first, then delete it." };
  const paid = await prisma.allocation.count({ where: { invoice: { lease: { unitId } } } });
  if (paid > 0) return { ok: false, error: "This unit has recorded M-Pesa payments, so deleting it would remove that history from your reports. It can't be deleted." };

  await prisma.unit.delete({ where: { id: unitId } });
  revalidatePath(`/dashboard/properties/${unit.propertyId}`);
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createTenantAndLease(formData: FormData) {
  const landlord = await requireLandlord();
  const unitId = String(formData.get("unitId") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const deposit = Math.round(Number(formData.get("deposit")) || 0);

  const unit = await prisma.unit.findFirst({ where: { id: unitId, property: { landlordId: landlord.id } } });
  if (!unit) return;

  await assignTenantToUnit({ landlordId: landlord.id, unitId, name, phone, email, deposit });

  revalidatePath(`/dashboard/properties/${unit.propertyId}`);
  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard/messages");
}

// Edit a tenant's contact details (name / phone / email). Phone is the M-Pesa
// number, so keep it normalized and valid.
export async function updateTenant(
  _prev: unknown,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const landlord = await requireLandlord();
  const tenantId = String(formData.get("tenantId") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, landlordId: landlord.id } });
  if (!tenant) return { error: "Tenant not found." };
  if (!name) return { error: "Name is required." };

  const phone = normalizeKenyanPhone(String(formData.get("phone") || ""));
  if (!validKenyanPhone(phone)) return { error: "Enter a valid Kenyan phone number." };

  await prisma.tenant.update({ where: { id: tenant.id }, data: { name, phone, email: email || null } });
  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Edit a property's name / location. The code is deliberately NOT editable — it
// prefixes every unit's M-Pesa payment reference, so changing it would break the
// references already given to tenants.
export async function updateProperty(
  _prev: unknown,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const landlord = await requireLandlord();
  const propertyId = String(formData.get("propertyId") || "");
  const name = String(formData.get("name") || "").trim();
  const location = String(formData.get("location") || "").trim();

  const property = await prisma.property.findFirst({ where: { id: propertyId, landlordId: landlord.id } });
  if (!property) return { error: "Property not found." };
  if (!name) return { error: "Property name is required." };

  await prisma.property.update({ where: { id: property.id }, data: { name, location: location || null } });
  revalidatePath("/dashboard/properties");
  revalidatePath(`/dashboard/properties/${property.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// Guarded delete. A property can only be removed when it holds no active
// tenancy and no recorded M-Pesa payments — deleting one with payment history
// would pull those figures out of the landlord's reports. Blocked cases return
// a message; a clean delete cascades the property's units/leases/invoices.
export async function deleteProperty(propertyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const landlord = await requireLandlord();
  const property = await prisma.property.findFirst({ where: { id: propertyId, landlordId: landlord.id } });
  if (!property) return { ok: false, error: "Property not found." };

  const activeLeases = await prisma.lease.count({ where: { status: "active", unit: { propertyId } } });
  if (activeLeases > 0) {
    return { ok: false, error: "This property has active tenants. End their leases first, then delete it." };
  }
  const paid = await prisma.allocation.count({ where: { invoice: { lease: { unit: { propertyId } } } } });
  if (paid > 0) {
    return { ok: false, error: "This property has recorded M-Pesa payments, so deleting it would remove that history from your reports. It can't be deleted." };
  }

  await prisma.property.delete({ where: { id: propertyId } });
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Same guard for a tenant: removable only with no active lease and no payments.
// A clean delete cascades their (ended) leases and unpaid invoices.
export async function deleteTenant(tenantId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const landlord = await requireLandlord();
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, landlordId: landlord.id } });
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const activeLeases = await prisma.lease.count({ where: { status: "active", tenantId } });
  if (activeLeases > 0) {
    return { ok: false, error: "This tenant has an active lease. Vacate them from their unit first, then delete." };
  }
  const paid = await prisma.allocation.count({ where: { invoice: { lease: { tenantId } } } });
  if (paid > 0) {
    return { ok: false, error: "This tenant has recorded M-Pesa payments, so deleting them would remove that history from your reports. They can't be deleted." };
  }

  await prisma.tenant.delete({ where: { id: tenantId } });
  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Bulk import — phase 1: dry-run. Reads the file and returns a plan; writes
// nothing. Rows that would touch an existing tenancy are flagged needsConfirm.
export async function planImportAction(
  propertyId: string,
  csv: string
): Promise<{ ok: true; plan: import("@/lib/import").ImportPlan } | { ok: false; error: string }> {
  const landlord = await requireLandlord();
  if (!csv.trim()) return { ok: false, error: "Upload an .xlsx file or paste some rows first." };
  const plan = await planImport(landlord.id, propertyId || null, csv);
  if (!plan.items.length) return { ok: false, error: "No rows found in that file." };
  return { ok: true, plan };
}

// Bulk import — phase 2: commit. New units/tenants always apply; rows that
// change an existing tenancy apply only if their line is in confirmedLines.
export async function commitImportAction(
  propertyId: string,
  csv: string,
  confirmedLines: number[]
): Promise<{ ok: true; result: import("@/lib/import").ImportResult } | { ok: false; error: string }> {
  const landlord = await requireLandlord();
  if (!csv.trim()) return { ok: false, error: "Nothing to import." };
  const result = await commitImport(landlord.id, propertyId || null, csv, confirmedLines || []);
  if (propertyId) revalidatePath(`/dashboard/properties/${propertyId}`);
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard");
  return { ok: true, result };
}

export async function createInviteAction(formData: FormData) {
  const landlord = await requireLandlord();
  const unitId = String(formData.get("unitId") || "");
  const unit = await prisma.unit.findFirst({ where: { id: unitId, property: { landlordId: landlord.id } } });
  if (!unit) return;
  await createInvite(landlord.id, unitId);
  revalidatePath(`/dashboard/properties/${unit.propertyId}`);
}

export async function revokeInviteAction(formData: FormData) {
  const landlord = await requireLandlord();
  const inviteId = String(formData.get("inviteId") || "");
  const propertyId = String(formData.get("propertyId") || "");
  await revokeInvite(landlord.id, inviteId);
  revalidatePath(`/dashboard/properties/${propertyId}`);
}

export async function endLease(formData: FormData) {
  const landlord = await requireLandlord();
  const leaseId = String(formData.get("leaseId") || "");
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, unit: { property: { landlordId: landlord.id } } },
    include: { unit: true },
  });
  if (!lease) return;
  await prisma.lease.update({ where: { id: leaseId }, data: { status: "ended", endDate: new Date() } });
  revalidatePath(`/dashboard/properties/${lease.unit.propertyId}`);
}

export async function addUtility(formData: FormData) {
  const landlord = await requireLandlord();
  const leaseId = String(formData.get("leaseId") || "");
  const type = String(formData.get("type") || "water") as "water" | "electricity" | "other";
  const amount = Math.round(Number(formData.get("amount")) || 0);
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, status: "active", unit: { property: { landlordId: landlord.id } } },
    include: { unit: true },
  });
  if (!lease || amount <= 0) return;
  const now = new Date();
  await addUtilityCharge(leaseId, type, amount, now.getUTCFullYear(), now.getUTCMonth() + 1);
  revalidatePath(`/dashboard/properties/${lease.unit.propertyId}`);
  revalidatePath("/dashboard/invoices");
}

export async function runBilling() {
  const landlord = await requireLandlord();
  const now = new Date();
  const { createdIds } = await runMonthlyRent(landlord.id, now.getUTCFullYear(), now.getUTCMonth() + 1);
  // Text every tenant their new invoice.
  await notifyInvoices(landlord.id, createdIds);
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard");
}

// Send an SMS arrears reminder to one tenant.
export async function sendReminder(formData: FormData) {
  const landlord = await requireLandlord();
  const leaseId = String(formData.get("leaseId") || "");
  await sendLeaseReminder(landlord.id, leaseId);
  revalidatePath("/dashboard/arrears");
  revalidatePath("/dashboard/messages");
}

// Blast SMS reminders to everyone in arrears.
export async function sendAllReminders() {
  const landlord = await requireLandlord();
  const rows = await arrearsList(landlord.id);
  for (const r of rows) {
    await sendLeaseReminder(landlord.id, r.leaseId);
  }
  revalidatePath("/dashboard/arrears");
  revalidatePath("/dashboard/messages");
}

// The M-Pesa simulator: build a payment and run it through reconciliation.
export async function simulatePayment(formData: FormData) {
  const landlord = await requireLandlord();
  const payRef = String(formData.get("payRef") || "").trim();
  const amount = Math.round(Number(formData.get("amount")) || 0);
  const phone = String(formData.get("phone") || "254712345678").trim();
  const name = String(formData.get("name") || "").trim();
  if (amount <= 0) return;

  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const mpesaCode = `SIM${Date.now().toString(36).toUpperCase().slice(-5)}${rand}`;

  await reconcilePayment({
    landlordId: landlord.id,
    mpesaCode,
    amount,
    payRef,
    payerPhone: phone,
    payerName: name || undefined,
    raw: JSON.stringify({ simulated: true }),
  });

  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard");
  redirect("/dashboard/payments");
}

// Manually attach an unmatched payment to a unit's active lease.
export async function manualReconcile(formData: FormData) {
  const landlord = await requireLandlord();
  const paymentId = String(formData.get("paymentId") || "");
  const payRef = String(formData.get("payRef") || "").trim().toUpperCase();

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, landlordId: landlord.id, status: "unmatched" },
  });
  if (!payment) return;

  // Re-run reconciliation against the corrected reference by reusing the engine:
  // delete the suspense record and recreate through reconcilePayment.
  await prisma.payment.delete({ where: { id: paymentId } });
  await reconcilePayment({
    landlordId: landlord.id,
    mpesaCode: payment.mpesaCode,
    amount: payment.amount,
    payRef,
    payerPhone: payment.payerPhone,
    payerName: payment.payerName || undefined,
    raw: payment.raw || undefined,
  });

  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard");
}

// --- Phase 2: Model A collections (landlord's own paybill) ---

const APP_BASE = process.env.APP_BASE_URL || "http://localhost:3000";

// Save a landlord's Daraja credentials (secret + passkey encrypted at rest).
export async function updateMpesaCredentials(formData: FormData) {
  const landlord = await requireLandlord();
  const env = String(formData.get("darajaEnv") || "sandbox") === "production" ? "production" : "sandbox";
  const consumerKey = String(formData.get("consumerKey") || "").trim();
  const consumerSecret = String(formData.get("consumerSecret") || "").trim();
  const passkey = String(formData.get("passkey") || "").trim();

  const data: Record<string, unknown> = { darajaEnv: env };
  if (consumerKey) data.darajaConsumerKey = consumerKey;
  // Only overwrite secrets when re-entered, so saving env-only keeps them.
  if (consumerSecret) data.darajaConsumerSecret = encrypt(consumerSecret);
  if (passkey) data.darajaPasskey = encrypt(passkey);

  await prisma.landlord.update({ where: { id: landlord.id }, data });

  // Mark connected once paybill + all three creds are present.
  const fresh = await prisma.landlord.findUnique({ where: { id: landlord.id } });
  const connected = Boolean(fresh?.paybill && fresh?.darajaConsumerKey && fresh?.darajaConsumerSecret && fresh?.darajaPasskey);
  await prisma.landlord.update({
    where: { id: landlord.id },
    data: { mpesaConnectedAt: connected ? fresh?.mpesaConnectedAt ?? new Date() : null },
  });
  revalidatePath("/dashboard/settings");
}

// Auto-register our C2B confirmation URL on the landlord's shortcode.
export async function registerCallbacks() {
  const landlord = await requireLandlord();
  const creds = resolveCreds(landlord);
  if (!creds) return;
  const url = `${APP_BASE}/api/mpesa/c2b/confirmation?landlord=${landlord.id}`;
  await registerC2B(creds, { confirmationUrl: url, validationUrl: url });
  revalidatePath("/dashboard/settings");
}

// Request-to-pay: STK Push the tenant for their outstanding balance.
export async function requestStkPayment(formData: FormData) {
  const landlord = await requireLandlord();
  const leaseId = String(formData.get("leaseId") || "");
  await initiateStkForLease(landlord.id, leaseId);
  revalidatePath("/dashboard/arrears");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard");
}

// Simulate an inbound WhatsApp message (dev tool) — runs the pay-in-chat bot.
export async function simulateWhatsAppInbound(
  _prev: unknown,
  formData: FormData
): Promise<{ reply?: string; error?: string }> {
  await requireLandlord();
  const phone = String(formData.get("phone") || "").trim();
  const text = String(formData.get("text") || "").trim();
  if (!phone || !text) return { error: "Enter a phone number and a message." };
  const outcome = await handleInboundWhatsApp({ fromPhone: phone, text });
  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/arrears");
  return { reply: outcome.reply };
}

// Pay a RentLink subscription invoice — STK Push to the PLATFORM paybill.
export async function payPlatformInvoice(formData: FormData) {
  const landlord = await requireLandlord();
  const invoiceId = String(formData.get("invoiceId") || "");
  const inv = await prisma.platformInvoice.findFirst({
    where: { id: invoiceId, landlordId: landlord.id, status: "open" },
  });
  if (!inv) return;

  const creds = platformCreds();
  if (!creds) {
    // Dry-run: mark the subscription invoice paid and activate.
    await prisma.platformInvoice.update({
      where: { id: inv.id },
      data: { status: "paid", paidAt: new Date(), mpesaReceipt: "SIM" + Date.now().toString(36).toUpperCase().slice(-6) },
    });
    await prisma.landlord.update({ where: { id: landlord.id }, data: { billingStatus: "active" } });
  } else {
    // Real: STK the landlord's phone to pay RentLink's paybill. Marked paid on callback.
    const res = await stkPush(creds, {
      phone: landlord.phone || "",
      amount: inv.amount,
      accountRef: "KEJA" + landlord.id.slice(-6),
      description: "RentLink fee",
      callbackUrl: `${APP_BASE}/api/mpesa/platform/callback`,
    });
    if (res.ok) {
      await prisma.platformInvoice.update({ where: { id: inv.id }, data: { checkoutRequestId: res.checkoutRequestId } });
    }
  }
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
}

// --- Phase 5: expenses & financials ---

export async function addExpense(formData: FormData) {
  const landlord = await requireLandlord();
  const propertyId = String(formData.get("propertyId") || "");
  const category = String(formData.get("category") || "other");
  const amount = Math.round(Number(formData.get("amount")) || 0);
  const note = String(formData.get("note") || "").trim();
  const dateStr = String(formData.get("date") || "").trim();

  const property = await prisma.property.findFirst({ where: { id: propertyId, landlordId: landlord.id } });
  if (!property || amount <= 0) return;

  const incurredAt = dateStr ? new Date(dateStr) : new Date();
  await prisma.expense.create({
    data: { propertyId, category, amount, note: note || null, incurredAt: isNaN(incurredAt.getTime()) ? new Date() : incurredAt },
  });
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
}

export async function deleteExpense(formData: FormData) {
  const landlord = await requireLandlord();
  const id = String(formData.get("id") || "");
  const expense = await prisma.expense.findFirst({ where: { id, property: { landlordId: landlord.id } } });
  if (!expense) return;
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
}

export async function updateSettings(formData: FormData) {
  const landlord = await requireLandlord();
  const businessName = String(formData.get("businessName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const paybill = String(formData.get("paybill") || "").trim();
  const smsSenderId = String(formData.get("smsSenderId") || "").trim();
  await prisma.landlord.update({
    where: { id: landlord.id },
    data: {
      businessName: businessName || null,
      phone: phone || null,
      paybill: paybill || null,
      smsSenderId: smsSenderId || null,
      // Checkboxes only appear in formData when checked.
      smsOn: formData.get("smsOn") === "on",
      whatsappOn: formData.get("whatsappOn") === "on",
      emailOn: formData.get("emailOn") === "on",
    },
  });
  revalidatePath("/dashboard/settings");
}
