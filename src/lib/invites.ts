// Self-service tenant invites. A landlord mints a link for a vacant unit; the
// tenant opens it, fills their details, and the lease is created — all shared
// with the manual/bulk paths via assignTenantToUnit.

import "server-only";
import crypto from "crypto";
import { prisma } from "./prisma";
import { assignTenantToUnit } from "./leasing";

const INVITE_DAYS = 14;

export async function createInvite(landlordId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, property: { landlordId } },
    include: { leases: { where: { status: "active" }, select: { id: true } } },
  });
  if (!unit || unit.leases.length) return null;

  // Reuse an existing pending invite rather than minting duplicates.
  const existing = await prisma.invite.findFirst({ where: { unitId, status: "pending" } });
  if (existing) return existing;

  const token = crypto.randomBytes(9).toString("base64url");
  return prisma.invite.create({
    data: { token, landlordId, unitId, status: "pending", expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) },
  });
}

export async function revokeInvite(landlordId: string, inviteId: string) {
  const invite = await prisma.invite.findFirst({ where: { id: inviteId, landlordId, status: "pending" } });
  if (!invite) return;
  await prisma.invite.update({ where: { id: invite.id }, data: { status: "expired" } });
}

export async function getInviteByToken(token: string) {
  return prisma.invite.findUnique({
    where: { token },
    include: { unit: { include: { property: true, leases: { where: { status: "active" }, select: { id: true } } } } },
  });
}

export async function acceptInvite(
  token: string,
  data: { name: string; phone: string; email?: string; deposit?: number }
): Promise<{ ok: boolean; error?: string }> {
  const invite = await getInviteByToken(token);
  if (!invite || invite.status !== "pending") return { ok: false, error: "This invite is no longer valid." };
  if (invite.expiresAt && invite.expiresAt < new Date()) return { ok: false, error: "This invite has expired." };
  if (invite.unit.leases.length) return { ok: false, error: "This unit has already been taken." };

  const res = await assignTenantToUnit({
    landlordId: invite.landlordId,
    unitId: invite.unitId,
    name: data.name,
    phone: data.phone,
    email: data.email,
    deposit: data.deposit,
  });
  if (!res.ok) return res;

  await prisma.invite.update({ where: { id: invite.id }, data: { status: "accepted", acceptedAt: new Date() } });
  return { ok: true };
}
