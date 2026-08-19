"use server";

import { acceptInvite } from "@/lib/invites";

// Public — no auth. A prospective tenant completes their own onboarding.
export async function acceptInviteAction(
  _prev: unknown,
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const token = String(formData.get("token") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const deposit = Math.round(Number(formData.get("deposit")) || 0);

  if (!name || !phone) return { error: "Please enter your name and M-Pesa phone number." };

  const res = await acceptInvite(token, { name, phone, email: email || undefined, deposit });
  if (!res.ok) return { error: res.error };
  return { ok: true };
}
