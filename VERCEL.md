# RentLink — Vercel Import Guide

The app deploys and runs **with only a database + four internal secrets**. Every
provider (SMS / email / WhatsApp / M-Pesa) stays in **dry-run** until you add its
keys, so you can deploy first and switch integrations on later.

## Step 1 — Neon Postgres (prerequisite)
Create a Neon project and copy the two connection strings, then apply the
one-time schema change in `DEPLOY.md` §1 (datasource → `postgresql`, add
`directUrl`). From your machine, point `.env` at Neon and run once:
```bash
npm run db:push      # create the tables in Neon
npm run db:seed      # optional demo data — SKIP for a clean production DB
```

## Step 2 — Import the repo
Vercel → **Add New… → Project** → import `rentlinkcoke-lang/rentlink`.
Framework preset auto-detects **Next.js**. Leave build settings default:
- Build: `prisma generate && next build` (from package.json)
- Install runs `postinstall` → `prisma generate`
No overrides needed.

## Step 3 — Environment variables
In the import screen, expand **Environment Variables**. Vercel accepts a pasted
`KEY=value` block. Paste all of the variables below (values shown separately —
never commit real secrets). Set them for **Production** (and Preview if you want).

### Required for the first deploy
| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** string (`…-pooler…`, add `&pgbouncer=true`) |
| `DIRECT_URL` | Neon **direct** string |
| `AUTH_SECRET` | random 48-byte string |
| `RENTLINK_ENC_KEY` | random 48-byte string — **keep stable forever** |
| `CRON_SECRET` | random string (Vercel Cron sends it as a Bearer token) |
| `APP_BASE_URL` | your Vercel URL, then the custom domain |
| `EMAIL_FROM` | `RentLink <receipts@rentlink.co.ke>` |

### Optional — blank = dry-run, add when going live
`ONFON_API_KEY`, `ONFON_CLIENT_ID`, `ONFON_ACCESS_KEY`, `ONFON_SENDER_ID`,
`RESEND_API_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_VERIFY_TOKEN`, `PLATFORM_MPESA_SHORTCODE`,
`PLATFORM_DARAJA_CONSUMER_KEY`, `PLATFORM_DARAJA_CONSUMER_SECRET`,
`PLATFORM_DARAJA_PASSKEY`.

Defaults that are fine to leave as-is: `WHATSAPP_API_VERSION=v21.0`,
`WHATSAPP_LANG=en`, `WHATSAPP_TEMPLATE_*` (rent_receipt / rent_invoice /
rent_reminder), `PLATFORM_DARAJA_ENV=sandbox`.

## Step 4 — Deploy
Click **Deploy**. First build takes ~1–2 min.

## Step 5 — Post-deploy
1. Copy the deployment URL → set `APP_BASE_URL` to it → **Redeploy** (so M-Pesa
   and WhatsApp callback URLs are correct).
2. **Cron** is picked up automatically from `vercel.json` (3 jobs). Because
   `CRON_SECRET` is set, Vercel signs cron requests with a Bearer token that
   `src/lib/cron.ts` already verifies.
3. Log in with the demo account (if you seeded) or register a fresh landlord.

## Step 6 — Custom domain (later)
Add `rentlink.co.ke` in Vercel → Domains, point DNS, then update `APP_BASE_URL`
and `EMAIL_FROM` to the domain and redeploy.

## Going live per provider
Add each provider's keys (above) → it auto-detects and leaves dry-run. See
`DEPLOY.md` §6 and `WHATSAPP_SETUP.md`.
