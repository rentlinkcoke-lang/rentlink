// Onfon Media SMS client.
// Docs: https://www.docs.onfonmedia.co.ke/rest/sms/
//
// POST https://api.onfonmedia.co.ke/v1/sms/SendBulkSMS
//   headers: Content-Type: application/json, AccessKey: <guid>
//   body:    { SenderId, ApiKey, ClientId, IsUnicode, IsFlash, MessageParameters:[{Number,Text}] }
//   ok resp: { ErrorCode: 0, ErrorDescription: "Success", Data:[{MobileNumber, MessageId}] }

const ONFON_URL = "https://api.onfonmedia.co.ke/v1/sms/SendBulkSMS";

export function onfonConfigured(): boolean {
  return Boolean(
    process.env.ONFON_API_KEY &&
      process.env.ONFON_CLIENT_ID &&
      process.env.ONFON_ACCESS_KEY
  );
}

export interface SmsResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

// GSM-7 basic set (+ common extension chars). Anything outside needs IsUnicode,
// which halves the segment length, so keep SMS templates within this set.
const GSM7 = /^[\r\nA-Za-z0-9 @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà\^{}\\\[~\]|€]*$/;

function needsUnicode(text: string): boolean {
  return !GSM7.test(text);
}

export async function onfonSend(opts: {
  to: string;
  text: string;
  senderId?: string;
}): Promise<SmsResult> {
  const AccessKey = process.env.ONFON_ACCESS_KEY!;
  const payload = {
    SenderId: opts.senderId || process.env.ONFON_SENDER_ID || "ONFON",
    ApiKey: process.env.ONFON_API_KEY,
    ClientId: process.env.ONFON_CLIENT_ID,
    IsUnicode: needsUnicode(opts.text),
    IsFlash: false,
    MessageParameters: [{ Number: opts.to, Text: opts.text }],
  };

  try {
    const res = await fetch(ONFON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", AccessKey },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ErrorCode?: number;
      ErrorDescription?: string;
      Data?: { MobileNumber: string; MessageId: string }[];
    };
    if (res.ok && json.ErrorCode === 0) {
      return { ok: true, messageId: json.Data?.[0]?.MessageId };
    }
    return {
      ok: false,
      error: json.ErrorDescription || `Onfon error (HTTP ${res.status}, code ${json.ErrorCode ?? "?"})`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error reaching Onfon" };
  }
}
