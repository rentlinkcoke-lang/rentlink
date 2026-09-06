// One-click sample data so a new landlord can see the whole loop — units with
// M-Pesa references, tenants, a reconciled payment and an arrears case — without
// entering anything. Everything is tagged isSample and removable in one click.
//
// It writes directly (no notifications) so seeding never sends real SMS/WhatsApp
// to the fake sample numbers.

import { prisma } from "./prisma";
import { generateUniquePayRef } from "./payref";
import { ensureRentInvoice } from "./invoices";

export async function hasSampleData(landlordId: string): Promise<boolean> {
  const n = await prisma.property.count({ where: { landlordId, isSample: true } });
  return n > 0;
}

export async function seedSampleData(landlordId: string): Promise<{ ok: boolean; error?: string }> {
  // Only ever seed into an empty account, so sample and real data never mix.
  const anyProperty = await prisma.property.count({ where: { landlordId } });
  if (anyProperty > 0) {
    return { ok: false, error: "Sample data can only be added to an empty account." };
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const property = await prisma.property.create({
    data: { landlordId, name: "Sample Apartments", code: "SMPL", location: "Nairobi", isSample: true },
  });

  const spec = [
    { label: "A1", rent: 25000, tenant: { name: "Achieng Wanjiru", phone: "254700000001" }, paid: true },
    { label: "A2", rent: 22000, tenant: { name: "Brian Otieno", phone: "254700000002" }, paid: false },
    { label: "A3", rent: 30000, tenant: null, paid: false },
  ];

  for (const u of spec) {
    const payRef = await generateUniquePayRef(property.code, u.label);
    const unit = await prisma.unit.create({
      data: { propertyId: property.id, label: u.label, rent: u.rent, bedrooms: 1, payRef },
    });
    if (!u.tenant) continue;

    const tenant = await prisma.tenant.create({
      data: { landlordId, name: u.tenant.name, phone: u.tenant.phone, isSample: true },
    });
    const lease = await prisma.lease.create({
      data: { unitId: unit.id, tenantId: tenant.id, startDate: now, rent: u.rent, deposit: u.rent, status: "active" },
    });
    const invoice = await ensureRentInvoice(lease.id, year, month);
    if (!invoice) continue;

    // A1 has already paid — reconcile it so the dashboard shows a real matched
    // payment + receipt; A2 stays open so arrears/occupancy look realistic.
    if (u.paid) {
      const mpesaCode = "SMP" + Math.random().toString(36).slice(2, 10).toUpperCase();
      const payment = await prisma.payment.create({
        data: {
          landlordId, mpesaCode, amount: u.rent, amountUnallocated: 0, payRef,
          payerPhone: u.tenant.phone, payerName: u.tenant.name, status: "matched",
          isSample: true, receivedAt: now,
        },
      });
      await prisma.allocation.create({ data: { paymentId: payment.id, invoiceId: invoice.id, amount: u.rent } });
      await prisma.invoice.update({ where: { id: invoice.id }, data: { amountPaid: u.rent, status: "paid" } });
      await prisma.messageLog.create({
        data: {
          landlordId, channel: "whatsapp", kind: "receipt", toPhone: u.tenant.phone, toName: u.tenant.name,
          tenantId: tenant.id, paymentId: payment.id, status: "simulated",
          body: `Hi ${u.tenant.name.split(" ")[0]}, we have received your rent payment of KES ${u.rent.toLocaleString("en-KE")} for Sample Apartments ${u.label}. You are fully paid. Asante.`,
        },
      });
    }
  }

  return { ok: true };
}

export async function clearSampleData(landlordId: string): Promise<{ ok: boolean }> {
  const tenants = await prisma.tenant.findMany({ where: { landlordId, isSample: true }, select: { id: true } });
  const tenantIds = tenants.map((t) => t.id);
  if (tenantIds.length) {
    await prisma.messageLog.deleteMany({ where: { landlordId, tenantId: { in: tenantIds } } });
  }
  await prisma.payment.deleteMany({ where: { landlordId, isSample: true } });     // cascades allocations
  await prisma.property.deleteMany({ where: { landlordId, isSample: true } });    // cascades units/leases/invoices
  await prisma.tenant.deleteMany({ where: { landlordId, isSample: true } });
  return { ok: true };
}
