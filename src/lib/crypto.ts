// AES-256-GCM encryption for credentials at rest (Daraja consumer secret & passkey).
// The key is derived from RENTLINK_ENC_KEY (or AUTH_SECRET) so any passphrase works.
// Server-only — uses Node crypto.

import "server-only";
import crypto from "crypto";

const keyMaterial = process.env.RENTLINK_ENC_KEY || process.env.AUTH_SECRET || "rentlink-dev";
const KEY = crypto.createHash("sha256").update(keyMaterial).digest(); // 32 bytes

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decrypt(payload: string): string {
  const [ivB, tagB, dataB] = payload.split(":");
  if (!ivB || !tagB || !dataB) throw new Error("Malformed ciphertext");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB, "base64")), decipher.final()]).toString("utf8");
}

export function safeDecrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decrypt(payload);
  } catch {
    return null;
  }
}
