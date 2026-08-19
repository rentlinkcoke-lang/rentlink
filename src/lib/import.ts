// Bulk unit/tenant import from CSV. Each row is a unit; if a tenant name + phone
// are present, it also creates the tenant, lease and first invoice.
//
// Columns (header row optional; if absent, this fixed order is assumed):
//   label, rent, bedrooms, tenant_name, tenant_phone, tenant_email, deposit

import { prisma } from "./prisma";
import { parseCsv } from "./csv";
import { generateUniquePayRef } from "./payref";
import { assignTenantToUnit } from "./leasing";

export interface ImportRow {
  line: number;
  status: "created" | "skipped";
  message: string;
}

export interface ImportResult {
  unitsCreated: number;
  tenantsCreated: number;
  skipped: number;
  rows: ImportRow[];
}

export const IMPORT_TEMPLATE =
  "label,rent,bedrooms,tenant_name,tenant_phone,tenant_email,deposit\n" +
  "A1,25000,2,Mary Achieng,0712345678,mary@example.com,25000\n" +
  "A2,25000,2,,,,\n" +
  "Shop 1,40000,0,Kamau Stores,0720000000,,40000\n";

export async function importUnitsCsv(landlordId: string, propertyId: string, csv: string): Promise<ImportResult> {
  const empty: ImportResult = { unitsCreated: 0, tenantsCreated: 0, skipped: 0, rows: [] };
  const property = await prisma.property.findFirst({ where: { id: propertyId, landlordId } });
  if (!property) return { ...empty, rows: [{ line: 0, status: "skipped", message: "Property not found." }] };

  const parsed = parseCsv(csv);
  if (!parsed.length) return { ...empty, rows: [{ line: 0, status: "skipped", message: "No rows found." }] };

  // Header detection + column mapping.
  const header = parsed[0].map((c) => c.trim().toLowerCase());
  const hasHeader = ["label", "unit", "rent"].some((h) => header.includes(h));
  const idx = (names: string[]) => {
    for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  let col = { label: 0, rent: 1, bedrooms: 2, name: 3, phone: 4, email: 5, deposit: 6 };
  let start = 0;
  if (hasHeader) {
    start = 1;
    col = {
      label: idx(["label", "unit"]),
      rent: idx(["rent"]),
      bedrooms: idx(["bedrooms", "beds"]),
      name: idx(["tenant_name", "tenant", "name"]),
      phone: idx(["tenant_phone", "phone", "msisdn"]),
      email: idx(["tenant_email", "email"]),
      deposit: idx(["deposit"]),
    };
  }

  const rows: ImportRow[] = [];
  let unitsCreated = 0;
  let tenantsCreated = 0;
  let skipped = 0;

  for (let r = start; r < parsed.length; r++) {
    const cells = parsed[r];
    const line = r + 1;
    const get = (i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : "");

    const label = get(col.label);
    const rent = Math.round(Number(get(col.rent)) || 0);
    if (!label) { rows.push({ line, status: "skipped", message: "Missing unit label." }); skipped++; continue; }
    if (rent <= 0) { rows.push({ line, status: "skipped", message: `Invalid rent for "${label}".` }); skipped++; continue; }

    const existing = await prisma.unit.findFirst({ where: { propertyId, label } });
    if (existing) { rows.push({ line, status: "skipped", message: `Unit "${label}" already exists.` }); skipped++; continue; }

    const bedrooms = get(col.bedrooms) ? Math.round(Number(get(col.bedrooms))) : null;
    const payRef = await generateUniquePayRef(property.code, label);
    const unit = await prisma.unit.create({
      data: { propertyId, label, rent, bedrooms: bedrooms && bedrooms >= 0 ? bedrooms : null, payRef },
    });
    unitsCreated++;

    const name = get(col.name);
    const phone = get(col.phone);
    if (name && phone) {
      const deposit = get(col.deposit) ? Math.round(Number(get(col.deposit))) : 0;
      const res = await assignTenantToUnit({ landlordId, unitId: unit.id, name, phone, email: get(col.email) || undefined, deposit });
      if (res.ok) { tenantsCreated++; rows.push({ line, status: "created", message: `Unit ${label} + tenant ${name}` }); }
      else rows.push({ line, status: "created", message: `Unit ${label} created; tenant skipped — ${res.error}` });
    } else {
      rows.push({ line, status: "created", message: `Unit ${label} (vacant)` });
    }
  }

  return { unitsCreated, tenantsCreated, skipped, rows };
}
