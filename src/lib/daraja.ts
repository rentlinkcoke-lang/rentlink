// Safaricom Daraja client — Model A (per-landlord shortcode).
//
// Each landlord connects THEIR OWN paybill, so every call is scoped to a landlord's
// decrypted credentials. We only ever INITIATE (STK Push) and READ (callbacks) —
// money settles directly to the landlord. Dry-run-safe: when a landlord hasn't
// connected credentials, callers simulate the round-trip instead of hitting Safaricom.

import "server-only";
import { safeDecrypt } from "./crypto";

export interface DarajaCreds {
  shortcode: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  env: "sandbox" | "production";
}

// Resolve a landlord row into usable (decrypted) creds, or null if incomplete.
export function resolveCreds(landlord: {
  paybill: string | null;
  darajaConsumerKey: string | null;
  darajaConsumerSecret: string | null;
  darajaPasskey: string | null;
  darajaEnv: string;
}): DarajaCreds | null {
  const secret = safeDecrypt(landlord.darajaConsumerSecret);
  const passkey = safeDecrypt(landlord.darajaPasskey);
  if (!landlord.paybill || !landlord.darajaConsumerKey || !secret || !passkey) return null;
  return {
    shortcode: landlord.paybill,
    consumerKey: landlord.darajaConsumerKey,
    consumerSecret: secret,
    passkey,
    env: landlord.darajaEnv === "production" ? "production" : "sandbox",
  };
}

function baseUrl(env: "sandbox" | "production"): string {
  return env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds())
  );
}

async function getToken(creds: DarajaCreds): Promise<string | null> {
  const auth = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");
  const res = await fetch(`${baseUrl(creds.env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => ({}))) as { access_token?: string };
  return json.access_token ?? null;
}

export interface StkResult {
  ok: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  error?: string;
}

// Lipa na M-Pesa Online (STK Push) — prompts the tenant's phone to pay the
// landlord's paybill, tagged with the unit's account reference.
export async function stkPush(
  creds: DarajaCreds,
  opts: { phone: string; amount: number; accountRef: string; description: string; callbackUrl: string }
): Promise<StkResult> {
  try {
    const token = await getToken(creds);
    if (!token) return { ok: false, error: "Could not authenticate with Safaricom (check consumer key/secret)." };

    const ts = timestamp();
    const password = Buffer.from(`${creds.shortcode}${creds.passkey}${ts}`).toString("base64");

    const res = await fetch(`${baseUrl(creds.env)}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: creds.shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: opts.amount,
        PartyA: opts.phone,
        PartyB: creds.shortcode,
        PhoneNumber: opts.phone,
        CallBackURL: opts.callbackUrl,
        AccountReference: opts.accountRef.slice(0, 12),
        TransactionDesc: opts.description.slice(0, 13),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
      ResponseCode?: string;
      errorMessage?: string;
    };
    if (res.ok && json.ResponseCode === "0") {
      return { ok: true, checkoutRequestId: json.CheckoutRequestID, merchantRequestId: json.MerchantRequestID };
    }
    return { ok: false, error: json.errorMessage || `STK Push rejected (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error reaching Safaricom" };
  }
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
}

// Register our C2B validation/confirmation URLs on the landlord's shortcode, so
// walk-in M-Pesa payments (not via STK) also flow to our reconciliation engine.
export async function registerC2B(
  creds: DarajaCreds,
  opts: { confirmationUrl: string; validationUrl: string }
): Promise<RegisterResult> {
  try {
    const token = await getToken(creds);
    if (!token) return { ok: false, error: "Could not authenticate with Safaricom." };
    const res = await fetch(`${baseUrl(creds.env)}/mpesa/c2b/v1/registerurl`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ShortCode: creds.shortcode,
        ResponseType: "Completed",
        ConfirmationURL: opts.confirmationUrl,
        ValidationURL: opts.validationUrl,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { ResponseDescription?: string; errorMessage?: string };
    if (res.ok) return { ok: true };
    return { ok: false, error: json.errorMessage || `Register failed (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error reaching Safaricom" };
  }
}
