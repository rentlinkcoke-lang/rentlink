"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin";

// Suspend locks a landlord out at next request (the dashboard layout checks it).
export async function suspendLandlord(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("landlordId") || "");
  if (!id) return;
  await prisma.landlord.update({ where: { id }, data: { suspended: true } });
  revalidatePath("/admin/landlords");
  revalidatePath(`/admin/landlords/${id}`);
}

export async function activateLandlord(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("landlordId") || "");
  if (!id) return;
  await prisma.landlord.update({ where: { id }, data: { suspended: false } });
  revalidatePath("/admin/landlords");
  revalidatePath(`/admin/landlords/${id}`);
}

// Edit a landlord's contact/identity fields. Integration secrets (paybill,
// Daraja keys) and the password are deliberately out of scope here.
export async function updateLandlord(
  _prev: unknown,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  await requireSuperAdmin();
  const id = String(formData.get("landlordId") || "");
  const name = String(formData.get("name") || "").trim();
  const businessName = String(formData.get("businessName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();

  const landlord = await prisma.landlord.findUnique({ where: { id } });
  if (!landlord || landlord.isSuperAdmin) return { error: "Landlord not found." };
  if (!name) return { error: "Name is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };

  const clash = await prisma.landlord.findFirst({ where: { email, id: { not: id } } });
  if (clash) return { error: "Another account already uses that email." };

  await prisma.landlord.update({
    where: { id },
    data: { name, businessName: businessName || null, email, phone: phone || null },
  });
  revalidatePath("/admin/landlords");
  revalidatePath(`/admin/landlords/${id}`);
  return { ok: true };
}

// Guarded delete. Deleting a landlord cascades their ENTIRE account, so it's
// only allowed for an empty/abandoned signup: no properties, no tenants, and no
// paid platform invoices (revenue history). Everything else should be Suspended.
export async function deleteLandlord(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperAdmin();
  const landlord = await prisma.landlord.findUnique({ where: { id } });
  if (!landlord) return { ok: false, error: "Landlord not found." };
  if (landlord.isSuperAdmin) return { ok: false, error: "A super-admin account can't be deleted here." };

  const [properties, tenants, paidInvoices] = await Promise.all([
    prisma.property.count({ where: { landlordId: id } }),
    prisma.tenant.count({ where: { landlordId: id } }),
    prisma.platformInvoice.count({ where: { landlordId: id, status: "paid" } }),
  ]);
  if (properties > 0 || tenants > 0) {
    return { ok: false, error: `This landlord has an active portfolio (${properties} propert${properties === 1 ? "y" : "ies"}, ${tenants} tenant${tenants === 1 ? "" : "s"}). Suspend them instead, or clear their portfolio first.` };
  }
  if (paidInvoices > 0) {
    return { ok: false, error: "This landlord has paid platform invoices (billing history). Suspend them instead of deleting." };
  }

  await prisma.landlord.delete({ where: { id } });
  revalidatePath("/admin/landlords");
  revalidatePath("/admin");
  return { ok: true };
}

// Manual billing-status override, for support / comps.
export async function setBillingStatus(formData: FormData) {
  await requireSuperAdmin();
  const id = String(formData.get("landlordId") || "");
  const status = String(formData.get("status") || "");
  if (!id || !["trialing", "active", "past_due", "canceled"].includes(status)) return;
  await prisma.landlord.update({ where: { id }, data: { billingStatus: status } });
  revalidatePath("/admin/landlords");
  revalidatePath(`/admin/landlords/${id}`);
}
