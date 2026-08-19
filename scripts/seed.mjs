// Seeds a demo landlord with a property, units, tenants, invoices and payments
// that show off every state: paid, partial, arrears, and a payment in suspense.
// Run: npm run db:seed  (wipes + reseeds the demo landlord)

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const YEAR = 2026;
const JUL = 7;
const AUG = 8;

function ref(code, label) {
  return (code + label).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function receipt({ tenant, property, unit, amount, code, lines, credit, business }) {
  const out = [];
  out.push(`✅ Payment received — KES ${amount.toLocaleString("en-KE")}`);
  out.push("");
  out.push(`Hi ${tenant.split(" ")[0]}, we've received your payment for ${property} ${unit}.`);
  out.push("");
  out.push("Applied to:");
  for (const l of lines) out.push(`• ${l.label} — KES ${l.amount.toLocaleString("en-KE")}`);
  if (credit > 0) out.push(`• Credit on account — KES ${credit.toLocaleString("en-KE")}`);
  out.push("");
  out.push(`Ref: ${code}`);
  out.push(`— ${business}`);
  return out.join("\n");
}

async function main() {
  const email = "demo@rentlink.co.ke";
  const business = "Mwangi Properties";

  // Fresh start for the demo account.
  const existing = await prisma.landlord.findUnique({ where: { email } });
  if (existing) {
    // MessageLog references the landlord by scalar id (no FK cascade), so clear it explicitly.
    await prisma.messageLog.deleteMany({ where: { landlordId: existing.id } });
    await prisma.landlord.delete({ where: { id: existing.id } });
  }

  const landlord = await prisma.landlord.create({
    data: {
      email,
      name: "Jane Mwangi",
      businessName: business,
      phone: "254722000111",
      paybill: "4109210",
      passwordHash: await bcrypt.hash("demo1234", 10),
      // Demo has all three channels on to showcase the spine (all dry-run).
      smsOn: true,
      whatsappOn: true,
      emailOn: true,
      // Past trial, active subscriber — shows the billing loop.
      billingStatus: "active",
      trialEndsAt: new Date(Date.UTC(2026, 6, 1)), // trial ended 1 Jul 2026
    },
  });

  const property = await prisma.property.create({
    data: { landlordId: landlord.id, name: "Bloom Court", code: "BLOOM", location: "Kilimani, Nairobi" },
  });

  // Units. Some occupied, one vacant.
  const unitDefs = [
    { label: "B1", rent: 25000, beds: 2 },
    { label: "B2", rent: 25000, beds: 2 },
    { label: "B3", rent: 18000, beds: 1 },
    { label: "B4", rent: 30000, beds: 3 },
    { label: "Shop1", rent: 40000, beds: 0 },
  ];
  const units = {};
  for (const d of unitDefs) {
    units[d.label] = await prisma.unit.create({
      data: { propertyId: property.id, label: d.label, rent: d.rent, bedrooms: d.beds || null, payRef: ref("BLOOM", d.label) },
    });
  }

  // Tenants + active leases (B4 stays vacant).
  const tenantDefs = [
    { unit: "B1", name: "Wanjiku Kamau", phone: "254712345678", email: "wanjiku@example.com" },
    { unit: "B2", name: "Otieno Odhiambo", phone: "254733112233", email: "otieno@example.com" },
    { unit: "B3", name: "Amina Hassan", phone: "254799887766" },
    { unit: "Shop1", name: "Njoroge Traders", phone: "254720445566", email: "accounts@njorogetraders.co.ke" },
  ];
  const leases = {};
  for (const t of tenantDefs) {
    const tenant = await prisma.tenant.create({
      data: { landlordId: landlord.id, name: t.name, phone: t.phone, email: t.email || null },
    });
    leases[t.unit] = await prisma.lease.create({
      data: {
        unitId: units[t.unit].id,
        tenantId: tenant.id,
        startDate: new Date(Date.UTC(2026, 0, 1)),
        rent: units[t.unit].rent,
        deposit: units[t.unit].rent,
        status: "active",
      },
    });
    leases[t.unit].tenant = tenant;
  }

  // Helper to raise a rent invoice.
  async function rent(unitLabel, month, status, amountPaid = 0) {
    const lease = leases[unitLabel];
    const amount = units[unitLabel].rent;
    return prisma.invoice.create({
      data: {
        leaseId: lease.id,
        periodYear: YEAR,
        periodMonth: month,
        type: "rent",
        amount,
        amountPaid,
        dueDate: new Date(Date.UTC(YEAR, month - 1, 5)),
        status,
      },
    });
  }

  // --- July: everyone billed; some paid ---
  const julB1 = await rent("B1", JUL, "paid", 25000);
  await rent("B2", JUL, "overdue", 0);          // B2 in arrears since July
  const julB3 = await rent("B3", JUL, "paid", 18000);
  const julShop1 = await rent("Shop1", JUL, "paid", 40000);

  // --- August (current month) ---
  const augB1 = await rent("B1", AUG, "paid", 25000);      // paid via matched payment below
  await rent("B2", AUG, "overdue", 0);                     // still owing
  const augB3 = await rent("B3", AUG, "partial", 10000);   // underpaid
  // Water charge on B3 August
  const augB3Water = await prisma.invoice.create({
    data: {
      leaseId: leases["B3"].id, periodYear: YEAR, periodMonth: AUG, type: "water",
      amount: 1200, amountPaid: 0, dueDate: new Date(Date.UTC(YEAR, AUG - 1, 5)), status: "overdue",
    },
  });
  await rent("Shop1", AUG, "pending", 0);                  // not yet paid, not yet due-swept

  // --- Payments ---
  // 1) B1 August rent — fully matched, receipt sent.
  const payB1 = await prisma.payment.create({
    data: {
      landlordId: landlord.id, mpesaCode: "SGH7X8Y9Z0", amount: 25000, amountUnallocated: 0,
      payRef: "BLOOMB1", payerPhone: "254712345678", payerName: "Wanjiku Kamau", status: "matched",
      receivedAt: new Date(Date.UTC(YEAR, AUG - 1, 3, 9, 12)),
    },
  });
  await prisma.allocation.create({ data: { paymentId: payB1.id, invoiceId: augB1.id, amount: 25000 } });
  await prisma.receipt.create({
    data: {
      paymentId: payB1.id, channel: "whatsapp", toPhone: "254712345678",
      body: receipt({ tenant: "Wanjiku Kamau", property: "Bloom Court", unit: "B1", amount: 25000, code: "SGH7X8Y9Z0", lines: [{ label: "August 2026 Rent", amount: 25000 }], credit: 0, business }),
    },
  });

  // 2) B3 partial payment (10,000 toward 18,000 rent).
  const payB3 = await prisma.payment.create({
    data: {
      landlordId: landlord.id, mpesaCode: "SGX1A2B3C4", amount: 10000, amountUnallocated: 0,
      payRef: "BLOOMB3", payerPhone: "254799887766", payerName: "Amina Hassan", status: "matched",
      receivedAt: new Date(Date.UTC(YEAR, AUG - 1, 6, 14, 40)),
    },
  });
  await prisma.allocation.create({ data: { paymentId: payB3.id, invoiceId: augB3.id, amount: 10000 } });
  await prisma.receipt.create({
    data: {
      paymentId: payB3.id, channel: "whatsapp", toPhone: "254799887766",
      body: receipt({ tenant: "Amina Hassan", property: "Bloom Court", unit: "B3", amount: 10000, code: "SGX1A2B3C4", lines: [{ label: "August 2026 Rent", amount: 10000 }], credit: 0, business }),
    },
  });

  // 3) A payment with a WRONG reference — lands in suspense.
  await prisma.payment.create({
    data: {
      landlordId: landlord.id, mpesaCode: "SGZ9Q8W7E6", amount: 25000, amountUnallocated: 25000,
      payRef: "BLOMB2", payerPhone: "254733112233", payerName: "Otieno Odhiambo", status: "unmatched",
      raw: JSON.stringify({ note: "typo in account number" }),
      receivedAt: new Date(Date.UTC(YEAR, AUG - 1, 8, 8, 5)),
    },
  });

  // Silence unused-var lint for the water invoice ref (kept for clarity).
  void augB3Water;

  // --- July collections (Payment + Allocation) so P&L income reflects July ---
  async function paidPayment(code, amount, ref, phone, name, invId, day) {
    const pay = await prisma.payment.create({
      data: {
        landlordId: landlord.id, mpesaCode: code, amount, amountUnallocated: 0, payRef: ref,
        payerPhone: phone, payerName: name, status: "matched", receivedAt: new Date(Date.UTC(YEAR, JUL - 1, day, 10, 0)),
      },
    });
    await prisma.allocation.create({ data: { paymentId: pay.id, invoiceId: invId, amount } });
  }
  await paidPayment("SGJULB1AA0", 25000, "BLOOMB1", "254712345678", "Wanjiku Kamau", julB1.id, 4);
  await paidPayment("SGJULB3BB0", 18000, "BLOOMB3", "254799887766", "Amina Hassan", julB3.id, 5);
  await paidPayment("SGJULSHOP0", 40000, "BLOOMSHOP1", "254720445566", "Njoroge Traders", julShop1.id, 2);

  // --- Earlier history (May & June: fully collected) so trends have shape ---
  const occupiedUnits = [
    { label: "B1", ref: "BLOOMB1", phone: "254712345678", name: "Wanjiku Kamau" },
    { label: "B2", ref: "BLOOMB2", phone: "254733112233", name: "Otieno Odhiambo" },
    { label: "B3", ref: "BLOOMB3", phone: "254799887766", name: "Amina Hassan" },
    { label: "Shop1", ref: "BLOOMSHOP1", phone: "254720445566", name: "Njoroge Traders" },
  ];
  for (const mo of [5, 6]) {
    for (const u of occupiedUnits) {
      const amt = units[u.label].rent;
      const inv = await prisma.invoice.create({
        data: {
          leaseId: leases[u.label].id, periodYear: YEAR, periodMonth: mo, type: "rent",
          amount: amt, amountPaid: amt, dueDate: new Date(Date.UTC(YEAR, mo - 1, 5)), status: "paid",
        },
      });
      const pay = await prisma.payment.create({
        data: {
          landlordId: landlord.id, mpesaCode: `SGH${mo}${u.ref}`.slice(0, 15), amount: amt, amountUnallocated: 0,
          payRef: u.ref, payerPhone: u.phone, payerName: u.name, status: "matched",
          receivedAt: new Date(Date.UTC(YEAR, mo - 1, 4, 9, 0)),
        },
      });
      await prisma.allocation.create({ data: { paymentId: pay.id, invoiceId: inv.id, amount: amt } });
    }
  }

  // --- Expenses (for the P&L) ---
  async function expense(cat, amount, note, monthNum, day) {
    await prisma.expense.create({
      data: { propertyId: property.id, category: cat, amount, note, incurredAt: new Date(Date.UTC(YEAR, monthNum - 1, day)) },
    });
  }
  await expense("repairs", 4500, "Plumber — B4 sink", AUG, 5);
  await expense("security", 8000, "Guard salary — August", AUG, 1);
  await expense("management", 3000, "Cleaning & garbage", AUG, 3);
  await expense("repairs", 2500, "Gate motor repair", JUL, 12);
  await expense("security", 8000, "Guard salary — July", JUL, 1);

  // --- RentLink subscription invoices (5 units x KES 75/unit = KES 375/mo) ---
  const UNIT_COUNT = 5, RATE = 75, AMT = UNIT_COUNT * RATE;
  await prisma.platformInvoice.create({
    data: {
      landlordId: landlord.id, periodYear: YEAR, periodMonth: JUL, unitCount: UNIT_COUNT, unitRate: RATE, amount: AMT,
      status: "paid", mpesaReceipt: "SGPJUL375", paidAt: new Date(Date.UTC(YEAR, JUL - 1, 3)), issuedAt: new Date(Date.UTC(YEAR, JUL - 1, 1)),
    },
  });
  await prisma.platformInvoice.create({
    data: {
      landlordId: landlord.id, periodYear: YEAR, periodMonth: AUG, unitCount: UNIT_COUNT, unitRate: RATE, amount: AMT,
      status: "open", issuedAt: new Date(Date.UTC(YEAR, AUG - 1, 1)),
    },
  });

  // A pending self-service invite on the vacant B4 (demoable link).
  await prisma.invite.create({
    data: {
      token: "demo-b4-invite", landlordId: landlord.id, unitId: units["B4"].id,
      status: "pending", expiresAt: new Date(Date.now() + 14 * 86_400_000),
    },
  });

  console.log("Seeded demo landlord:");
  console.log("  email:    demo@rentlink.co.ke");
  console.log("  password: demo1234");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
