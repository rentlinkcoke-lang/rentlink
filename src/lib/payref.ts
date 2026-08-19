// Payment-reference generation — the killer feature.
// Each unit gets a stable, human-typeable account number the tenant enters as
// the M-Pesa account/reference. It must be unique across the whole platform so
// an incoming C2B payment maps to exactly one unit.

import { prisma } from "./prisma";

// Keep it short, uppercase, no ambiguous chars (no O/0/I/1 confusion): we use
// the property code + a cleaned unit label. e.g. property "BLOOM" unit "B4" -> "BLOOMB4".
export function normalizeRef(propertyCode: string, unitLabel: string): string {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${clean(propertyCode)}${clean(unitLabel)}`;
}

// Ensures uniqueness by appending a numeric suffix on collision.
export async function generateUniquePayRef(propertyCode: string, unitLabel: string): Promise<string> {
  const base = normalizeRef(propertyCode, unitLabel);
  let candidate = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.unit.findUnique({ where: { payRef: candidate } });
    if (!existing) return candidate;
    n += 1;
    candidate = `${base}${n}`;
  }
}
