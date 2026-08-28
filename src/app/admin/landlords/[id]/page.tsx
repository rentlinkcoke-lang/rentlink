import Link from "next/link";
import { notFound } from "next/navigation";
import { landlordDetail } from "@/lib/admin";
import { kes, kesShort, periodLabel } from "@/lib/format";
import { StatCard, PageHeader, StatusBadge } from "../../../ui";
import { suspendLandlord, activateLandlord, setBillingStatus } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminLandlordDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await landlordDetail(id);
  if (!d) notFound();
  const { landlord: l, counts, invoices } = d;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Link href="/admin/landlords" className="faint" style={{ fontSize: 13 }}>← All landlords</Link>
      </div>
      <PageHeader
        title={l.businessName || l.name}
        subtitle={`${l.name} · ${l.email}${l.phone ? " · " + l.phone : ""}`}
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={l.suspended ? "suspended" : l.billingStatus} />
            <form action={l.suspended ? activateLandlord : suspendLandlord}>
              <input type="hidden" name="landlordId" value={l.id} />
              <button className="btn btn-ghost" style={{ fontSize: 13 }}>{l.suspended ? "Reactivate" : "Suspend"}</button>
            </form>
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        <StatCard label="MRR" value={kes(d.mrr)} sub={`${counts.units} billable units`} accent="green" />
        <StatCard label="Collected this month" value={kesShort(d.collectedThisMonth)} />
        <StatCard label="Arrears" value={kesShort(d.arrears)} accent={d.arrears > 0 ? "amber" : undefined} />
        <StatCard label="Occupancy" value={`${counts.occupancy}%`} sub={`${counts.activeLeases} of ${counts.units} let`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <div className="card card-pad">
          <div className="stat-label">Portfolio</div>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <Kv k="Properties" v={String(counts.properties)} />
            <Kv k="Units" v={String(counts.units)} />
            <Kv k="Tenants" v={String(counts.tenants)} />
            <Kv k="Active leases" v={String(counts.activeLeases)} />
          </div>
        </div>
        <div className="card card-pad">
          <div className="stat-label">Account</div>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <Kv k="Joined" v={new Date(l.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
            <Kv k="Paybill" v={l.paybill || "—"} />
            <Kv k="Trial ends" v={l.trialEndsAt ? new Date(l.trialEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
              <span className="muted">Billing status</span>
              <form action={setBillingStatus} style={{ display: "flex", gap: 6 }}>
                <input type="hidden" name="landlordId" value={l.id} />
                <select name="status" defaultValue={l.billingStatus} className="select" style={{ fontSize: 13, padding: "4px 8px" }}>
                  <option value="trialing">Trialing</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past due</option>
                  <option value="canceled">Canceled</option>
                </select>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }}>Set</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div className="h2">Platform invoices</div>
        </div>
        <table className="data">
          <thead>
            <tr><th>Period</th><th>Units</th><th>Rate</th><th>Status</th><th style={{ textAlign: "right" }}>Amount</th></tr>
          </thead>
          <tbody>
            {invoices.map((iv) => (
              <tr key={iv.id}>
                <td>{periodLabel(iv.periodYear, iv.periodMonth)}</td>
                <td>{iv.unitCount}</td>
                <td>{kes(iv.unitRate)}</td>
                <td><span className={`badge badge-${iv.status === "paid" ? "green" : iv.status === "open" ? "amber" : "slate"}`}>{iv.status}</span></td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{kes(iv.amount)}</td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={5} className="faint" style={{ textAlign: "center", padding: 24 }}>No platform invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
      <span className="muted">{k}</span>
      <span style={{ fontWeight: 700 }}>{v}</span>
    </div>
  );
}
