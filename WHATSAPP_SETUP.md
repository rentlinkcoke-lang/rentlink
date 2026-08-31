# WhatsApp channel — going live

RentLink sends receipts, invoices and reminders over WhatsApp using the **Meta
WhatsApp Cloud API**. Because these are *business-initiated* messages, they must
use **pre-approved message templates** — you can't send free-form text unless the
tenant messaged you in the last 24 hours.

Until this is set up, the WhatsApp channel runs in **dry-run**: messages are
logged in the Messages outbox but not sent (no cost).

## 1. Provision the Cloud API

1. Create a Meta Business account and complete **business verification** (this is
   the long-lead step — it can take days).
2. Add the **WhatsApp** product, register a phone number, and get a **permanent
   access token** (System User token) and the **Phone Number ID**.
3. Put them in `.env`:

```bash
WHATSAPP_ACCESS_TOKEN="EAAG…"
WHATSAPP_PHONE_NUMBER_ID="123456789012345"
WHATSAPP_API_VERSION="v21.0"
WHATSAPP_LANG="en"
```

## 2. Create & submit these templates

In Meta Business Manager → **WhatsApp Manager → Message Templates**, create three
templates (category **Utility**), with these exact bodies. The `{{n}}` are the
ordered parameters RentLink fills in — the names must match `.env`.

### `rent_receipt`
```
Hi {{1}}, we've received {{2}} for {{3}}.
{{4}}
Ref: {{5}}
— {{6}}
```
Params: name · amount · property+unit · balance line · M-Pesa ref · business

### `rent_invoice`
```
Hi {{1}}, your {{2}} rent for {{3}} is {{4}}.
Pay via M-Pesa Paybill {{5}}, Account {{6}}.
— {{7}}
```
Params: name · period · property+unit · amount · paybill · account ref · business

### `rent_reminder`
```
Hi {{1}}, a reminder that {{2}} has an outstanding balance of {{3}}.
Pay via M-Pesa Paybill {{4}}, Account {{5}}.
— {{6}}
```
Params: name · property+unit · balance · paybill · account ref · business

If you name your templates differently, set the names in `.env`:
`WHATSAPP_TEMPLATE_RECEIPT`, `WHATSAPP_TEMPLATE_INVOICE`, `WHATSAPP_TEMPLATE_REMINDER`.

## 3. Register the webhook

In the Meta app dashboard → **WhatsApp → Configuration → Webhook → Edit**:

```
Callback URL   https://rentlink.co.ke/api/whatsapp/webhook
Verify token   rentlink-wa-2026        (must equal WHATSAPP_VERIFY_TOKEN in Vercel)
```

Set `WHATSAPP_VERIFY_TOKEN` in the deploy env **before** clicking "Verify and save",
or the handshake fails. Then subscribe to the **`messages`** field — that powers the
pay-in-chat bot (`GET`/`POST` handled by `src/app/api/whatsapp/webhook/route.ts`).

Tip: with Meta's **test number** you can send the approved templates to up to 5
verified recipient numbers *before* business verification finishes — enough to test
the whole pipeline end-to-end.

## 4. Turn it on

Once the templates are **approved** and the credentials are set, open
**Settings → Notify tenants on** and tick **WhatsApp**. RentLink will start sending
template messages to each tenant's phone number.

## How it maps in code

- Client: `src/lib/whatsapp.ts` (`whatsappSendTemplate` → Graph API).
- Template payloads + previews: `src/lib/whatsapp-templates.ts`.
- Dispatch + outbox logging: `src/lib/notify.ts` (`sendWhatsApp`).
- Wired into the same three events as SMS/email: `reconcile.ts`, `invoices.ts`.
- Gated per landlord by the `whatsappOn` flag (Settings toggle).
