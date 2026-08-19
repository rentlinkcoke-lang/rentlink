# RentLink — Go-Live Runbook

Everything is built and runs locally on SQLite in dry-run. This is the path to
production. Provision all accounts under **rentlink.co.ke@gmail.com**.

Order matters: start the **long-lead** items (WhatsApp, domain) first.

---

## 0. Accounts to create (you)
| Service | For | Notes |
|---|---|---|
| GitHub | source repo `rentlink` | |
| Neon | Postgres database | free tier is fine to start |
| Vercel | hosting + cron | connect the GitHub repo |
| Onfon Media | SMS | you already have this |
| Resend | email | verify the `rentlink.co.ke` domain |
| Meta Business | WhatsApp Cloud API | **long lead** — business verification + template approval |
| Safaricom Daraja | production M-Pesa | per-landlord + RentLink's own paybill |
| KeNIC registrar | domain `rentlink.co.ke` | |

---

## 1. Migrate SQLite → Postgres (required for serverless)
SQLite doesn't persist on Vercel. Switch to Neon Postgres.

**a. Create a Neon project**, copy the two connection strings (pooled + direct).

**b. Edit `prisma/schema.prisma`** — change the datasource block to:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled (…-pooler…, add &pgbouncer=true)
  directUrl = env("DIRECT_URL")     // direct (for migrations)
}
```

**c. Set in `.env`** (and later in Vercel):
```
DATABASE_URL="postgresql://…-pooler…/db?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://…/db?sslmode=require"
```

**d. Create the schema + seed:**
```bash
npm run db:push
npm run db:seed   # optional demo data; skip for a clean production DB
```

> Nothing else changes — all queries are provider-agnostic Prisma. Local dev can
> stay on SQLite by keeping the old datasource block on a separate branch, or just
> point `.env` at a Neon dev branch.

---

## 2. Secrets — generate real values
Replace every dev placeholder in `.env` (and mirror them in Vercel):
```bash
# AUTH_SECRET, RENTLINK_ENC_KEY, CRON_SECRET, WHATSAPP_VERIFY_TOKEN
openssl rand -base64 48   # run once per secret
```
`.env.example` lists every variable. **Keep `RENTLINK_ENC_KEY` stable** once
landlords store Daraja credentials — changing it invalidates them.

---

## 3. GitHub
```bash
git remote add origin https://github.com/<rentlink-org>/rentlink.git
git push -u origin main
```

## 4. Vercel
1. Import the `rentlink` GitHub repo.
2. Add every env var from `.env.example` (with production values).
3. Build command is already `prisma generate && next build`; `postinstall` runs
   `prisma generate`. No extra config needed.
4. Set `APP_BASE_URL` to the deployed URL (then the custom domain).

## 5. Cron (Vercel Cron)
Add to `vercel.json` (create it) — hit the scheduler endpoints with the secret:
```json
{
  "crons": [
    { "path": "/api/cron/monthly-invoices", "schedule": "0 6 1 * *" },
    { "path": "/api/cron/reminders",        "schedule": "0 8 * * *" },
    { "path": "/api/cron/platform-billing", "schedule": "0 5 1 * *" }
  ]
}
```
Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron requests
when the `CRON_SECRET` env var is set — `src/lib/cron.ts` already accepts that header,
so no secret goes in `vercel.json`. (`vercel.json` is committed with the schedules.)

---

## 6. Providers — flip from dry-run to live
Each integration auto-detects its keys and goes live once present:
- **Onfon (SMS):** set `ONFON_*`. Approve a Sender ID.
- **Resend (email):** set `RESEND_API_KEY`; verify `rentlink.co.ke` DNS (SPF/DKIM).
- **WhatsApp:** finish Meta verification, create + get the 3 templates approved
  (`WHATSAPP_SETUP.md`), set `WHATSAPP_*`, register the inbound webhook
  (`/api/whatsapp/webhook` + verify token) for pay-in-chat.
- **Daraja (collections):** each landlord connects their own paybill in Settings.
  Register the C2B confirmation URL + STK callback on their shortcode.
- **Daraja (billing):** set `PLATFORM_*` for RentLink's own paybill.

## 7. Domain
Register `rentlink.co.ke`, point DNS at Vercel, add it as the primary domain,
update `APP_BASE_URL` + `EMAIL_FROM`.

## 8. Compliance (later)
eTIMS + KRA rental-tax reporting sit on top of the P&L data (Reports page).

---

## Recommended sequence
1. **Today:** start Meta/WhatsApp verification; register the domain.
2. **Then (fast):** Neon → Postgres migration → GitHub → Vercel deploy.
3. Drop in Onfon + Resend keys → SMS/email live in minutes.
4. Daraja production go-live test with one real paybill.
5. WhatsApp live once templates are approved; eTIMS/KRA last.
