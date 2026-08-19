// Inbound WhatsApp Cloud API webhook.
//   GET  — Meta's subscription verification handshake.
//   POST — incoming messages → the pay-in-chat bot.
//
// Register this URL + verify token in the Meta app's WhatsApp → Configuration.

import { NextRequest, NextResponse } from "next/server";
import { handleInboundWhatsApp } from "@/lib/chatbot";

// GET: echo hub.challenge if the verify token matches.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN || "keja-verify";
  if (mode === "subscribe" && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface WaWebhookBody {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: { from?: string; type?: string; text?: { body?: string } }[];
      };
    }[];
  }[];
}

export async function POST(req: NextRequest) {
  let body: WaWebhookBody;
  try {
    body = (await req.json()) as WaWebhookBody;
  } catch {
    return NextResponse.json({ ok: true }); // ack malformed so Meta doesn't retry
  }

  // Walk the (deeply nested) payload for text messages.
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const profileName = value?.contacts?.[0]?.profile?.name;
      for (const msg of value?.messages ?? []) {
        if (msg.type === "text" && msg.from && msg.text?.body) {
          try {
            await handleInboundWhatsApp({ fromPhone: msg.from, text: msg.text.body, profileName });
          } catch (e) {
            console.error("pay-in-chat error", e);
          }
        }
      }
    }
  }

  // Meta expects a fast 200.
  return NextResponse.json({ ok: true });
}
