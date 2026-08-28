"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, createSession, destroySession } from "@/lib/auth";

export async function registerAction(_prev: unknown, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const businessName = String(formData.get("businessName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!name || !email || password.length < 6) {
    return { error: "Enter your name, email, and a password of at least 6 characters." };
  }

  const existing = await prisma.landlord.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const landlord = await prisma.landlord.create({
    data: {
      name,
      email,
      businessName: businessName || null,
      passwordHash: await hashPassword(password),
      paybill: process.env.MPESA_PAYBILL || "4109210",
      billingStatus: "trialing",
      trialEndsAt,
    },
  });
  await createSession(landlord.id);
  redirect("/dashboard");
}

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const landlord = await prisma.landlord.findUnique({ where: { email } });
  if (!landlord || !(await verifyPassword(password, landlord.passwordHash))) {
    return { error: "Wrong email or password." };
  }
  if (landlord.suspended) {
    return { error: "This account is suspended. Contact RentLink support." };
  }
  await createSession(landlord.id);
  redirect(landlord.isSuperAdmin ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
