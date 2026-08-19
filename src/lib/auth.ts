// Server-only auth. Imports next/headers, so never import this from a client
// component — keep client-safe helpers in format.ts.

import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const COOKIE = "keja_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret");

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createSession(landlordId: string): Promise<void> {
  const token = await new SignJWT({ sub: landlordId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionLandlordId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentLandlord() {
  const id = await getSessionLandlordId();
  if (!id) return null;
  return prisma.landlord.findUnique({ where: { id } });
}

// Throws-free guard for server components that need a user.
export async function requireLandlord() {
  const landlord = await getCurrentLandlord();
  if (!landlord) throw new Error("UNAUTHENTICATED");
  return landlord;
}
