// Bulk unit/tenant import from a spreadsheet (CSV pasted, or an .xlsx parsed in
// the browser and handed over as CSV). Each row is a unit; if a tenant name +
// phone are present, it also creates the tenant, lease and first invoice.
//
// This is a create-only loader for standing up a portfolio. It never edits or
// removes existing records — a unit that already exists is skipped. Ongoing
// changes (a tenant moving out/in, rent changes) are done in the dashboard GUI.
//
// Columns (header row recommended; order-independent when a header is present):
//   property, label, rent, bedrooms, tenant_name, tenant_phone, tenant_email, deposit
// The optional `property` column lets one file span several buildings — each
// named property is found or created for the landlord. Rows with no property
// fall back to the property picked in the form.

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
  propertiesCreated: number;
  unitsCreated: number;
  tenantsCreated: number;
  skipped: number;
  rows: ImportRow[];
}

// A ready-to-edit sample: two buildings, some let, some vacant.
export const IMPORT_TEMPLATE =
  "property,label,rent,bedrooms,tenant_name,tenant_phone,tenant_email,deposit\n" +
  "Bloom Court,A1,25000,2,Mary Achieng,0712345678,mary@example.com,25000\n" +
  "Bloom Court,A2,25000,2,,,,\n" +
  "Bloom Court,Shop 1,40000,0,Kamau Stores,0720000000,,40000\n" +
  "Riverside Flats,B1,32000,3,John Otieno,0733000000,john@example.com,32000\n" +
  "Riverside Flats,B2,32000,3,,,,\n";

// Property code from a name (mirrors createProperty in dashboard actions).
function codeFromName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "PROP";
}

export async function importUnitsCsv(
  landlordId: string,
  defaultPropertyId: string | null,
  csv: string
): Promise<ImportResult> {
  const empty: ImportResult = { propertiesCreated: 0, unitsCreated: 0, tenantsCreated: 0, skipped: 0, rows: [] };

  const parsed = parseCsv(csv);
  if (!parsed.length) return { ...empty, rows: [{ line: 0, status: "skipped", message: "No rows found." }] };

  // Preload this landlord's properties so we can find-or-create by name, and
  // keep codes unique across the whole run.
  const existingProps = await prisma.property.findMany({ where: { landlordId } });
  const propByName = new Map(existingProps.map((p) => [p.name.trim().toLowerCase(), p]));
  const usedCodes = new Set(existingProps.map((p) => p.code));
  const defaultProp = defaultPropertyId ? existingProps.find((p) => p.id === defaultPropertyId) ?? null : null;
  let propertiesCreated = 0;

  async function ensureProperty(nameCell: string) {
    const nm = nameCell.trim();
    if (!nm) return defaultProp;
    const hit = propByName.get(nm.toLowerCase());
    if (hit) return hit;
    let base = codeFromName(nm), c = base, n = 1;
    while (usedCodes.has(c)) { n += 1; c = `${base}${n}`; }
    usedCodes.add(c);
    const created = await prisma.property.create({ data: { landlordId, name: nm, code: c } });
    propByName.set(nm.toLowerCase(), created);
    propertiesCreated += 1;
    return created;
  }

  // Header detection + column mapping.
  const header = parsed[0].map((c) => c.trim().toLowerCase());
  const hasHeader = ["property", "label", "unit", "rent"].some((h) => header.includes(h));
  const idx = (names: string[]) => {
    for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  let col = { property: -1, label: 0, rent: 1, bedrooms: 2, name: 3, phone: 4, email: 5, deposit: 6 };
  let start = 0;
  if (hasHeader) {
    start = 1;
    col = {
      property: idx(["property", "property_name", "building"]),
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
    if (cells.every((c) => !c.trim())) continue; // blank line

    const label = get(col.label);
    const rent = Math.round(Number(get(col.rent)) || 0);
    if (!label) { rows.push({ line, status: "skipped", message: "Missing unit label." }); skipped++; continue; }
    if (rent <= 0) { rows.push({ line, status: "skipped", message: `Invalid rent for "${label}".` }); skipped++; continue; }

    const property = await ensureProperty(get(col.property));
    if (!property) { rows.push({ line, status: "skipped", message: `No property for "${label}" — add a Property column or pick one above.` }); skipped++; continue; }

    const existing = await prisma.unit.findFirst({ where: { propertyId: property.id, label } });
    if (existing) { rows.push({ line, status: "skipped", message: `Unit "${label}" already exists in ${property.name}.` }); skipped++; continue; }

    const bedrooms = get(col.bedrooms) ? Math.round(Number(get(col.bedrooms))) : null;
    const payRef = await generateUniquePayRef(property.code, label);
    const unit = await prisma.unit.create({
      data: { propertyId: property.id, label, rent, bedrooms: bedrooms && bedrooms >= 0 ? bedrooms : null, payRef },
    });
    unitsCreated++;

    const name = get(col.name);
    const phone = get(col.phone);
    if (name && phone) {
      const deposit = get(col.deposit) ? Math.round(Number(get(col.deposit))) : 0;
      const res = await assignTenantToUnit({ landlordId, unitId: unit.id, name, phone, email: get(col.email) || undefined, deposit });
      if (res.ok) { tenantsCreated++; rows.push({ line, status: "created", message: `${property.name} · ${label} + tenant ${name}` }); }
      else rows.push({ line, status: "created", message: `${property.name} · ${label} created; tenant skipped — ${res.error}` });
    } else {
      rows.push({ line, status: "created", message: `${property.name} · ${label} (vacant)` });
    }
  }

  return { propertiesCreated, unitsCreated, tenantsCreated, skipped, rows };
}
