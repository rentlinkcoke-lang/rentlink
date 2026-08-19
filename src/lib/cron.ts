// Shared guard for scheduler endpoints. Accepts the secret via either the
// Authorization: Bearer header (Vercel Cron) or a ?key= query param (manual runs).

import { NextRequest } from "next/server";

export function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get("key") === secret) return true;
  return false;
}
