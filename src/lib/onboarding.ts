// Onboarding progress for a landlord — the four steps that lead to the first
// self-reconciling payment. Drives the dashboard checklist; hidden once done.

import { prisma } from "./prisma";

export interface OnboardingState {
  hasProperty: boolean;
  hasUnit: boolean;
  hasTenant: boolean;
  hasReconciled: boolean;
  hasSample: boolean;
  isEmpty: boolean;
  done: number;
  total: number;
  complete: boolean;
}

export async function onboardingState(landlordId: string): Promise<OnboardingState> {
  const [properties, units, activeLeases, matched, sample] = await Promise.all([
    prisma.property.count({ where: { landlordId } }),
    prisma.unit.count({ where: { property: { landlordId } } }),
    prisma.lease.count({ where: { status: "active", unit: { property: { landlordId } } } }),
    prisma.payment.count({ where: { landlordId, status: "matched" } }),
    prisma.property.count({ where: { landlordId, isSample: true } }),
  ]);

  const hasProperty = properties > 0;
  const hasUnit = units > 0;
  const hasTenant = activeLeases > 0;
  const hasReconciled = matched > 0;
  const steps = [hasProperty, hasUnit, hasTenant, hasReconciled];
  const done = steps.filter(Boolean).length;

  return {
    hasProperty,
    hasUnit,
    hasTenant,
    hasReconciled,
    hasSample: sample > 0,
    isEmpty: properties === 0,
    done,
    total: steps.length,
    complete: done === steps.length,
  };
}
