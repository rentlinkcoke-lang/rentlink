// Shared "put a tenant into a unit" path — used by the manual assign form, the
// bulk CSV import, and the self-service invite accept flow. One place that
// creates the tenant + lease, bills the first month, and sends the invoice.

import { prisma } from "./prisma";
import { ensureRentInvoice, notifyInvoices } from "./invoices";
import { normalizeKenyanPhone, validKenyanPhone } from "./phone";

export interface AssignArgs {
  landlordId: string;
  unitId: string;
  name: string;
  phone: string;
  email?: string;
  deposit?: number;
}

export interface AssignResult {
  ok: boolean;
  error?: string;
  leaseId?: string;
}

export async function assignTenantToUnit(args: AssignArgs): Promise<AssignResult> {
  const name = args.name.trim();
  const phone = normalizeKenyanPhone(args.phone);
  if (!name) return { ok: false, error: "Tenant name is required." };
  if (!validKenyanPhone(phone)) return { ok: false, error: "Enter a valid Kenyan phone number." };

  const unit = await prisma.unit.findFirst({
    where: { id: args.unitId, property: { landlordId: args.landlordId } },
    include: { leases: { where: { status: "active" }, select: { id: true } } },
  });
  if (!unit) return { ok: false, error: "Unit not found." };
  if (unit.leases.length) return { ok: false, error: "This unit already has an active tenant." };

  const tenant = await prisma.tenant.create({
    data: { landlordId: args.landlordId, name, phone, email: args.email?.trim() || null },
  });
  const lease = await prisma.lease.create({
    data: {
      unitId: args.unitId,
      tenantId: tenant.id,
      startDate: new Date(),
      rent: unit.rent,
      deposit: args.deposit && args.deposit > 0 ? Math.round(args.deposit) : 0,
      status: "active",
    },
  });

  // Bill the current month and text/email the first invoice.
  const now = new Date();
  const invoice = await ensureRentInvoice(lease.id, now.getUTCFullYear(), now.getUTCMonth() + 1);
  if (invoice) await notifyInvoices(args.landlordId, [invoice.id]);

  return { ok: true, leaseId: lease.id };
}
