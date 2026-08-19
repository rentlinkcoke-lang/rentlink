// WhatsApp Cloud API (Meta) client.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
//
// POST https://graph.facebook.com/{version}/{PHONE_NUMBER_ID}/messages
//   headers: Authorization: Bearer {ACCESS_TOKEN}, Content-Type: application/json
//   ok resp: { messages: [{ id: "wamid..." }], contacts: [...] }
//
// Business-INITIATED messages (our receipts / invoices / reminders) must use a
// pre-approved TEMPLATE — you can only send free-form text inside the 24h window
// after a customer messages you. So we send template messages with body params.
// See WHATSAPP_SETUP.md for the template bodies to submit for approval.

const VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export interface WhatsAppResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function whatsappSendTemplate(opts: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams: string[];
}): Promise<WhatsAppResult> {
  const url = `https://graph.facebook.com/${VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: opts.to,
    type: "template",
    template: {
      name: opts.templateName,
      language: { code: opts.languageCode || process.env.WHATSAPP_LANG || "en" },
      components: opts.bodyParams.length
        ? [{ type: "body", parameters: opts.bodyParams.map((t) => ({ type: "text", text: t })) }]
        : [],
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message?: string };
    };
    if (res.ok && json.messages?.[0]?.id) return { ok: true, id: json.messages[0].id };
    return { ok: false, error: json.error?.message || `WhatsApp error (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error reaching WhatsApp" };
  }
}

// Free-form text reply — allowed only inside the 24h customer-service window
// (i.e. after the tenant messages us first). Used by the pay-in-chat bot.
export async function whatsappSendText(opts: { to: string; body: string }): Promise<WhatsAppResult> {
  const url = `https://graph.facebook.com/${VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: opts.to,
        type: "text",
        text: { preview_url: false, body: opts.body },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (res.ok && json.messages?.[0]?.id) return { ok: true, id: json.messages[0].id };
    return { ok: false, error: json.error?.message || `WhatsApp error (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error reaching WhatsApp" };
  }
}
