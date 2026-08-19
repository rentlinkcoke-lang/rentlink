import { requireLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { platformCreds, billingSummary, PRICE_TIERS, unitRate } from "@/lib/platform-billing";
import { kes, periodLabel, shortDate } from "@/lib/format";
import { Badge, PageHeader, StatCard } from "../../ui";
import { payPlatformInvoice } from "../actions";

export default async function BillingPage() {
  const landlord = await requireLandlord();
  const s = await billingSummary(landlord.id);
  const live = platformCreds() != null;

  const invoices = await prisma.platformInvoice.findMany({
    where: { landlordId: landlord.id },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    take: 12,
  });

  const statusBadge =
    s.trialActive ? { st: "slate", label: `trial · ${s.trialDaysLeft}d left` }
    : s.status === "active" ? { st: "matched", label: "active" }
    : s.status === "past_due" ? { st: "unmatched", label: "payment due" }
    : { st: "slate", label: s.status };

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="Your RentLink subscription — a simple per-unit fee that gets cheaper as you grow."
        action={<Badge status={statusBadge.st} label={statusBadge.label} />}
      />

      {/* current charge */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        <StatCard label="Units managed" value={String(s.unitCount)} sub="across all your properties" />
        <StatCard label="Your rate" value={`${kes(s.rate)}`} sub="per unit / month" />
        <StatCard label="Monthly total" value={kes(s.amount)} sub={`${s.unitCount} × ${kes(s.rate)}`} accent="green" />
        <StatCard
          label="Status"
          value={s.trialActive ? `${s.trialDaysLeft} days` : s.status === "active" ? "Active" : "Due"}
          sub={s.trialActive ? "left in free trial" : s.status === "active" ? "subscription current" : "settle to continue"}
          accent={s.dueNow ? "red" : undefined}
        />
      </div>

      {/* trial / due banner */}
      {s.trialActive && (
        <div className="card card-pad" style={{ marginTop: 18, background: "var(--brand-tint)", borderColor: "var(--brand)" }}>
          <div className="h2" style={{ color: "var(--brand-dark)" }}>You're on a free trial</div>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            All features are unlocked. Your first bill of <b>{kes(s.amount)}</b> is generated when your trial ends
            {s.trialEndsAt ? ` on ${shortDate(s.trialEndsAt)}` : ""}. No charge until then.
          </div>
        </div>
      )}

      {s.openInvoice && (
        <div className="card card-pad" style={{ marginTop: 18, borderColor: "var(--amber)", background: "var(--amber-tint)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div className="h2" style={{ color: "var(--amber)" }}>Subscription due — {kes(s.openInvoice.amount)}</div>
              <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                For {periodLabel(s.openInvoice.periodYear, s.openInvoice.periodMonth)}.
                {live ? " Tap to get an M-Pesa prompt on your phone." : " (Dry-run: connect RentLink's paybill to charge for real.)"}
              </div>
            </div>
            <form action={payPlatformInvoice}>
              <input type="hidden" name="invoiceId" value={s.openInvoice.id} />
              <button className="btn btn-primary">Pay {kes(s.openInvoice.amount)} via M-Pesa</button>
            </form>
          </div>
        </div>
      )}

      {/* pricing tiers */}
      <div className="card" style={{ marginTop: 18, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }} className="h2">Pricing — the more you manage, the less per unit</div>
        <table className="data">
          <thead>
            <tr><th>Portfolio size</th><th style={{ textAlign: "right" }}>Per unit / month</th><th></th></tr>
          </thead>
          <tbody>
            {PRICE_TIERS.map((t) => {
              const active = unitRate(s.unitCount) === t.rate;
              return (
                <tr key={t.label}>
                  <td style={{ fontWeight: active ? 700 : 500 }}>{t.label}</td>
                  <td style={{ textAlign: "right", fontWeight: active ? 700 : 500 }} className="mono">{kes(t.rate)}</td>
                  <td style={{ textAlign: "right" }}>{active && <Badge status="matched" label="your tier" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* history */}
      <div className="card" style={{ marginTop: 18, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }} className="h2">Invoice history</div>
        {invoices.length === 0 ? (
          <div className="faint" style={{ padding: 28, textAlign: "center", fontSize: 14 }}>No subscription invoices yet.</div>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Period</th><th>Units</th><th style={{ textAlign: "right" }}>Amount</th><th>Issued</th><th>Status</th></tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 600 }}>{periodLabel(i.periodYear, i.periodMonth)}</td>
                  <td className="muted">{i.unitCount} × {kes(i.unitRate)}</td>
                  <td style={{ textAlign: "right" }} className="mono">{kes(i.amount)}</td>
                  <td className="muted" style={{ fontSize: 13 }}>{shortDate(i.issuedAt)}</td>
                  <td><Badge status={i.status === "paid" ? "matched" : i.status === "open" ? "amber" : "slate"} label={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
