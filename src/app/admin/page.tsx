import Link from "next/link";
import { platformOverview, landlordsList } from "@/lib/admin";
import { kes, kesShort } from "@/lib/format";
import { StatCard, PageHeader, StatusBadge } from "../ui";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [o, landlords] = await Promise.all([platformOverview(), landlordsList()]);
  const top = landlords.slice(0, 6);

  return (
    <div>
      <PageHeader title="Platform overview" subtitle="Every landlord on RentLink, at a glance." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        <StatCard label="Monthly recurring revenue" value={kes(o.mrr)} sub={`${o.units} billable units`} accent="green" />
        <StatCard label="Landlords" value={String(o.landlords)} sub={`${o.byStatus.active} active · ${o.byStatus.trialing} trialing`} />
        <StatCard label="Collected this month" value={kesShort(o.collectedThisMonth)} sub="across all landlords" />
        <StatCard label="Platform arrears" value={kesShort(o.arrears)} sub="open tenant invoices" accent={o.arrears > 0 ? "amber" : undefined} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <div className="card card-pad">
          <div className="stat-label">Subscription mix</div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <MixRow label="Active" n={o.byStatus.active} total={o.landlords} color="var(--green)" />
            <MixRow label="Trialing" n={o.byStatus.trialing} total={o.landlords} color="var(--brand)" />
            <MixRow label="Past due" n={o.byStatus.past_due} total={o.landlords} color="var(--amber)" />
            <MixRow label="Canceled" n={o.byStatus.canceled} total={o.landlords} color="var(--ink-faint)" />
          </div>
        </div>
        <div className="card card-pad">
          <div className="stat-label">Operations</div>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <Kv k="Tenants managed" v={String(o.tenants)} />
            <Kv k="Billable units" v={String(o.units)} />
            <Kv k="Payments in suspense" v={String(o.unmatched)} warn={o.unmatched > 0} />
            <Kv k="Suspended accounts" v={String(o.suspended)} warn={o.suspended > 0} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div className="h2">Top landlords by MRR</div>
          <Link href="/admin/landlords" className="faint" style={{ fontSize: 13 }}>View all →</Link>
        </div>
        <table className="data">
          <thead>
            <tr><th>Landlord</th><th>Units</th><th>Status</th><th style={{ textAlign: "right" }}>MRR</th></tr>
          </thead>
          <tbody>
            {top.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/admin/landlords/${l.id}`} style={{ fontWeight: 600, color: "var(--ink)" }}>{l.businessName || l.name}</Link>
                  <div className="faint" style={{ fontSize: 12 }}>{l.email}</div>
                </td>
                <td>{l.units}</td>
                <td><StatusBadge status={l.suspended ? "suspended" : l.billingStatus} /></td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{kes(l.mrr)}</td>
              </tr>
            ))}
            {top.length === 0 && (
              <tr><td colSpan={4} className="faint" style={{ textAlign: "center", padding: 28 }}>No landlords yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MixRow({ label, n, total, color }: { label: string; n: number; total: number; color: string }) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span>{label}</span><span className="faint">{n} · {pct}%</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: "var(--bg)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

function Kv({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
      <span className="muted">{k}</span>
      <span style={{ fontWeight: 700, color: warn ? "var(--amber)" : "var(--ink)" }}>{v}</span>
    </div>
  );
}

