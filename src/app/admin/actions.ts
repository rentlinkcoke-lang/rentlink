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
