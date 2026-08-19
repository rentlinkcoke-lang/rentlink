// Resend email client.
// Docs: https://resend.com/docs/api-reference/emails/send-email
//
// POST https://api.resend.com/emails
//   headers: Authorization: Bearer re_xxx, Content-Type: application/json
//   body:    { from, to, subject, html, text }
//   ok resp: { id: "..." }

const RESEND_URL = "https://api.resend.com/emails";

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export interface EmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function resendSend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailResult> {
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (res.ok && json.id) return { ok: true, id: json.id };
    return { ok: false, error: json.message || `Resend error (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error reaching Resend" };
  }
}
