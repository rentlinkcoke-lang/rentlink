# RentLink — rent that reconciles itself

Property-management SaaS for the Kenyan market. The spine is a **self-reconciling
rent loop**: every unit gets its own M-Pesa payment reference, so when a tenant
pays, RentLink instantly knows _who_ paid, for _which unit_, for _which month_ — marks
the invoice paid, and drafts a WhatsApp receipt. The landlord does nothing.

```
Property → Unit → Tenant → Lease → Invoice → M-Pesa → Reconciliation
```

## The killer feature

Each unit has a unique reference (e.g. `BLOOMB4`) = the M-Pesa **account number**
under the landlord's Paybill. An incoming C2B payment carries that reference, so
reconciliation is deterministic:

- **Exact pay** → invoice marked `paid`, receipt drafted.
- **Underpay** → invoice `partial`, arrears tracked.
- **Overpay / early** → applied oldest-first, remainder held as **credit on account**.
- **Wrong / missing ref** → lands in **suspense** for one-click manual reconcile.

Payments are idempotent on the M-Pesa code, and allocation is oldest-invoice-first.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Prisma **v6** + SQLite ·
`jose` httpOnly-cookie auth · bcryptjs · Tailwind v4. Server Actions for all
mutations; a real Daraja-compatible webhook for production.

## Run

```bash
cd C:\cowork\RentLink
npm install
npm run db:push
npm run db:seed
npm run dev        # http://localhost:3000
```

**Demo login:** `demo@rentlink.co.ke` / `demo1234` — comes seeded with Bloom Court
(5 units), tenants in every payment state, and one payment sitting in suspense.

## Try the loop

1. **Simulate M-Pesa** in the sidebar → pick a reference, enter an amount, send.
2. Watch it reconcile on **Payments**, with the drafted WhatsApp receipt.
3. Type a _wrong_ reference to see a payment fall into **suspense**, then fix it.

## Going live with real M-Pesa

Register this Daraja **C2B Confirmation URL** (shown on Settings):

```
POST /api/mpesa/c2b/confirmation?landlord=<landlordId>
```

It parses Safaricom's C2B payload (`TransID`, `TransAmount`, `BillRefNumber`,
`MSISDN`, …) and runs the same reconciliation engine as the simulator, returning
the `{ ResultCode: 0 }` ACK Safaricom expects.

## Architecture

| Area | File |
|------|------|
| Data model | `prisma/schema.prisma` |
| Reconciliation engine | `src/lib/reconcile.ts` |
| Payment-reference generation | `src/lib/payref.ts` |
| Daraja C2B parser | `src/lib/mpesa.ts` |
| Invoicing & arrears | `src/lib/invoices.ts` |
| Dashboard aggregates | `src/lib/stats.ts` |
| Webhook | `src/app/api/mpesa/c2b/confirmation/route.ts` |
| Mutations (Server Actions) | `src/app/dashboard/actions.ts` |

## Roadmap (from the product brief)

Built: the core loop, arrears, water/electricity billing, tenant statements
(receipts), WhatsApp reminders (click-to-chat), utility charges, occupancy
analytics, expense model.

Next: lease-document generation, maintenance tickets, caretaker & owner portals,
eTIMS + KRA rental-tax reporting, vacancy advertising, and per-unit billing
(KES 50–100 / unit / month).
