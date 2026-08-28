// Bulk unit/tenant import from a spreadsheet (CSV pasted, or an .xlsx parsed in
// the browser and handed over as CSV).
//
// Two phases so the landlord stays in control:
//   1. planImport()   — read-only. Classifies every row and flags anything that
//                       would touch an EXISTING tenancy (occupied unit, or a
//                       different tenant on a unit already in the system).
//   2. commitImport() — writes. New units/tenants always apply; rows that change
//                       an existing tenancy apply ONLY if the landlord ticked
//                       them (their line is in `confirmedLines`).
//
// Columns (header row recommended; order-independent when a header is present):
//   property, label, rent, bedrooms, tenant_name, tenant_phone, tenant_email, deposit

import { prisma } from "./prisma";
import { parseCsv } from "./csv";
import { generateUniquePayRef } from "./payref";
import { assignTenantToUnit } from "./leasing";
import { normalizeKenyanPhone } from "./phone";

export interface ImportResult {
  propertiesCreated: number;
  unitsCreated: number;
  tenantsCreated: number;
  tenantsUpdated: number;
  skipped: number;
  rows: { line: number; status: "created" | "updated" | "skipped"; message: string }[];
}

// What the importer intends to do with one row, before it does it.
export type PlanAction = "new-unit" | "assign-existing" | "update-tenant" | "skip" | "invalid";

export interface PlanItem {
  line: number;
  property: string;
  label: string;
  tenant: string;
  phone: string;
  action: PlanAction;
  needsConfirm: boolean;   // touches an existing tenancy → landlord must approve
  note: string;
  existingTenant?: string; // current occupant, for update/replace rows
}

export interface ImportPlan {
  items: PlanItem[];
  newUnits: number;
  newTenants: number;
  confirmations: number; // how many rows need approval
  skips: number;
  invalid: number;
  propertiesToCreate: string[];
}

export const IMPORT_TEMPLATE =
  "property,label,rent,bedrooms,tenant_name,tenant_phone,tenant_email,deposit\n" +
  "Bloom Court,A1,25000,2,Mary Achieng,0712345678,mary@example.com,25000\n" +
  "Bloom Court,A2,25000,2,,,,\n" +
  "Bloom Court,Shop 1,40000,0,Kamau Stores,0720000000,,40000\n" +
  "Riverside Flats,B1,32000,3,John Otieno,0733000000,john@example.com,32000\n" +
  "Riverside Flats,B2,32000,3,,,,\n";

function codeFromName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "PROP";
}

interface ParsedRow {
  line: number;
  propertyName: string;
  label: string;
  rent: number;
  bedrooms: number | null;
  name: string;
  phone: string;
  email: string;
  deposit: number;
  invalid?: string;
}

// Turn raw CSV text into normalized rows (shared by plan + commit so line
// numbers and parsing always match).
function parseRows(csv: string): ParsedRow[] {
  const parsed = parseCsv(csv);
  if (!parsed.length) return [];

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

  const rows: ParsedRow[] = [];
  for (let r = start; r < parsed.length; r++) {
    const cells = parsed[r];
    if (cells.every((c) => !c.trim())) continue; // blank line
    const get = (i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : "");
    const label = get(col.label);
    const rent = Math.round(Number(get(col.rent)) || 0);
    const bd = get(col.bedrooms);
    const row: ParsedRow = {
      line: r + 1,
      propertyName: get(col.property),
      label,
      rent,
      bedrooms: bd ? Math.round(Number(bd)) : null,
      name: get(col.name),
      phone: get(col.phone),
      email: get(col.email),
      deposit: get(col.deposit) ? Math.round(Number(get(col.deposit))) : 0,
    };
    if (!label) row.invalid = "Missing unit label.";
    else if (rent <= 0) row.invalid = `Invalid rent for "${label}".`;
    rows.push(row);
  }
  return rows;
}

// Resolve which property a row belongs to, from a preloaded name→property map
// plus the fallback picked in the form. Returns null when it must be created.
function propLookup(existing: { id: string; name: string; code: string }[], defaultPropertyId: string | null) {
  const byName = new Map(existing.map((p) => [p.name.trim().toLowerCase(), p]));
  const def = defaultPropertyId ? existing.find((p) => p.id === defaultPropertyId) ?? null : null;
  return (nameCell: string) => {
    const nm = nameCell.trim();
    if (!nm) return { name: def?.name ?? "", prop: def };
    return { name: nm, prop: byName.get(nm.toLowerCase()) ?? null };
  };
}

interface RowDecision {
  action: PlanAction;
  needsConfirm: boolean;
  note: string;
  propertyName: string;
  existingTenant?: string;
  unitId?: string;
  leaseId?: string;
  tenantId?: string;
}

// Decide what to do with one row given current DB state (no writes).
async function decide(row: ParsedRow, lookup: ReturnType<typeof propLookup>): Promise<RowDecision> {
  if (row.invalid) return { action: "invalid", needsConfirm: false, note: row.invalid, propertyName: row.propertyName };

  const { name: propertyName, prop } = lookup(row.propertyName);
  if (!propertyName) {
    return { action: "invalid", needsConfirm: false, note: `No property for "${row.label}" — add a property column or pick one.`, propertyName: "" };
  }

  const hasTenant = !!(row.name && row.phone);

  // Property not yet created → everything under it is brand new.
  if (!prop) {
    return {
      action: "new-unit",
      needsConfirm: false,
      note: hasTenant ? `New unit in ${propertyName}, with tenant ${row.name}` : `New unit in ${propertyName} (vacant)`,
      propertyName,
    };
  }

  const unit = await prisma.unit.findFirst({
    where: { propertyId: prop.id, label: row.label },
    include: { leases: { where: { status: "active" }, include: { tenant: true } } },
  });

  if (!unit) {
    return {
      action: "new-unit",
      needsConfirm: false,
      note: hasTenant ? `New unit in ${propertyName}, with tenant ${row.name}` : `New unit in ${propertyName} (vacant)`,
      propertyName,
    };
  }

  const activeLease = unit.leases[0];

  if (!hasTenant) {
    return { action: "skip", needsConfirm: false, note: `Unit ${row.label} already exists — no tenant given, nothing to change.`, propertyName, unitId: unit.id };
  }

  if (activeLease) {
    const cur = activeLease.tenant;
    const samePerson = cur.name.trim().toLowerCase() === row.name.trim().toLowerCase()
      && normalizeKenyanPhone(cur.phone) === normalizeKenyanPhone(row.phone);
    if (samePerson) {
      // Contact detail changes only (e.g. email) — still an existing tenancy.
      const emailChanged = (cur.email || "") !== (row.email || "");
      if (!emailChanged) {
        return { action: "skip", needsConfirm: false, note: `${cur.name} already recorded on ${row.label} — no change.`, propertyName, unitId: unit.id };
      }
      return { action: "update-tenant", needsConfirm: true, note: `Update ${cur.name}'s email on ${row.label}`, propertyName, existingTenant: cur.name, tenantId: cur.id, unitId: unit.id, leaseId: activeLease.id };
    }
    // Different tenant on an occupied unit → the sensitive case.
    return {
      action: "update-tenant",
      needsConfirm: true,
      note: `${row.label} is occupied by ${cur.name} (${cur.phone}). Confirm to update these details to ${row.name} (${normalizeKenyanPhone(row.phone)}).`,
      propertyName,
      existingTenant: cur.name,
      tenantId: cur.id,
      unitId: unit.id,
      leaseId: activeLease.id,
    };
  }

  // Existing but vacant unit + a tenant in the file → assign (touches an existing unit).
  return {
    action: "assign-existing",
    needsConfirm: true,
    note: `Assign ${row.name} to existing vacant unit ${row.label} in ${propertyName}`,
    propertyName,
    unitId: unit.id,
  };
}

export async function planImport(landlordId: string, defaultPropertyId: string | null, csv: string): Promise<ImportPlan> {
  const rows = parseRows(csv);
  const existing = await prisma.property.findMany({ where: { landlordId }, select: { id: true, name: true, code: true } });
  const lookup = propLookup(existing, defaultPropertyId);

  const items: PlanItem[] = [];
  const newPropNames = new Set<string>();
  const existingNames = new Set(existing.map((p) => p.name.trim().toLowerCase()));
  let newUnits = 0, newTenants = 0, confirmations = 0, skips = 0, invalid = 0;

  for (const row of rows) {
    const d = await decide(row, lookup);
    if (d.action === "new-unit") {
      newUnits++;
      if (row.name && row.phone) newTenants++;
      if (d.propertyName && !existingNames.has(d.propertyName.toLowerCase())) newPropNames.add(d.propertyName);
    } else if (d.needsConfirm) confirmations++;
    else if (d.action === "invalid") invalid++;
    else skips++;

    items.push({
      line: row.line,
      property: d.propertyName || row.propertyName,
      label: row.label,
      tenant: row.name,
      phone: row.phone ? normalizeKenyanPhone(row.phone) : "",
      action: d.action,
      needsConfirm: d.needsConfirm,
      note: d.note,
      existingTenant: d.existingTenant,
    });
  }

  return {
    items,
    newUnits,
    newTenants,
    confirmations,
    skips,
    invalid,
    propertiesToCreate: [...newPropNames],
  };
}

export async function commitImport(
  landlordId: string,
  defaultPropertyId: string | null,
  csv: string,
  confirmedLines: number[]
): Promise<ImportResult> {
  const confirmed = new Set(confirmedLines);
  const rows = parseRows(csv);

  const existing = await prisma.property.findMany({ where: { landlordId }, select: { id: true, name: true, code: true } });
  const byName = new Map(existing.map((p) => [p.name.trim().toLowerCase(), p]));
  const usedCodes = new Set(existing.map((p) => p.code));
  const def = defaultPropertyId ? existing.find((p) => p.id === defaultPropertyId) ?? null : null;

  const out: ImportResult = { propertiesCreated: 0, unitsCreated: 0, tenantsCreated: 0, tenantsUpdated: 0, skipped: 0, rows: [] };

  async function ensureProperty(nameCell: string) {
    const nm = nameCell.trim();
    if (!nm) return def;
    const hit = byName.get(nm.toLowerCase());
    if (hit) return hit;
    let base = codeFromName(nm), c = base, n = 1;
    while (usedCodes.has(c)) { n += 1; c = `${base}${n}`; }
    usedCodes.add(c);
    const created = await prisma.property.create({ data: { landlordId, name: nm, code: c }, select: { id: true, name: true, code: true } });
    byName.set(nm.toLowerCase(), created);
    out.propertiesCreated++;
    return created;
  }

  // Re-derive the decision at commit time (DB may have changed since preview),
  // then act — gating the sensitive rows on the landlord's confirmation.
  const lookup = propLookup([...byName.values()], def?.id ?? null);

  for (const row of rows) {
    const d = await decide(row, lookup);
    const line = row.line;

    if (d.action === "invalid") { out.skipped++; out.rows.push({ line, status: "skipped", message: d.note }); continue; }
    if (d.action === "skip") { out.skipped++; out.rows.push({ line, status: "skipped", message: d.note }); continue; }

    if (d.needsConfirm && !confirmed.has(line)) {
      out.skipped++;
      out.rows.push({ line, status: "skipped", message: `Not confirmed — ${row.label} left unchanged.` });
      continue;
    }

    if (d.action === "new-unit") {
      const property = await ensureProperty(row.propertyName || (def?.name ?? ""));
      if (!property) { out.skipped++; out.rows.push({ line, status: "skipped", message: `No property for "${row.label}".` }); continue; }
      const exists = await prisma.unit.findFirst({ where: { propertyId: property.id, label: row.label } });
      if (exists) { out.skipped++; out.rows.push({ line, status: "skipped", message: `Unit ${row.label} already exists in ${property.name}.` }); continue; }
      const payRef = await generateUniquePayRef(property.code, row.label);
      const unit = await prisma.unit.create({
        data: { propertyId: property.id, label: row.label, rent: row.rent, bedrooms: row.bedrooms && row.bedrooms >= 0 ? row.bedrooms : null, payRef },
      });
      out.unitsCreated++;
      if (row.name && row.phone) {
        const res = await assignTenantToUnit({ landlordId, unitId: unit.id, name: row.name, phone: row.phone, email: row.email || undefined, deposit: row.deposit });
        if (res.ok) { out.tenantsCreated++; out.rows.push({ line, status: "created", message: `${property.name} · ${row.label} + tenant ${row.name}` }); }
        else out.rows.push({ line, status: "created", message: `${property.name} · ${row.label} created; tenant skipped — ${res.error}` });
      } else {
        out.rows.push({ line, status: "created", message: `${property.name} · ${row.label} (vacant)` });
      }
    } else if (d.action === "assign-existing" && d.unitId) {
      const res = await assignTenantToUnit({ landlordId, unitId: d.unitId, name: row.name, phone: row.phone, email: row.email || undefined, deposit: row.deposit });
      if (res.ok) { out.tenantsCreated++; out.rows.push({ line, status: "created", message: `Assigned ${row.name} to ${row.label}` }); }
      else { out.skipped++; out.rows.push({ line, status: "skipped", message: `Could not assign ${row.name} — ${res.error}` }); }
    } else if (d.action === "update-tenant" && d.tenantId) {
      await prisma.tenant.update({
        where: { id: d.tenantId },
        data: { name: row.name, phone: normalizeKenyanPhone(row.phone), email: row.email || null },
      });
      out.tenantsUpdated++;
      out.rows.push({ line, status: "updated", message: `Updated tenant on ${row.label} → ${row.name}` });
    }
  }

  return out;
}
