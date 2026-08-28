import Link from "next/link";
import { landlordsList } from "@/lib/admin";
import { kes } from "@/lib/format";
import { PageHeader, StatusBadge } from "../../ui";
import { suspendLandlord, activateLandlord } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLandlords() {
  const rows = await landlordsList();
  const totalMrr = rows.reduce((s, r) => s + r.mrr, 0);

  return (
    <div>
      <PageHeader title="Landlords" subtitle={`${rows.length} account${rows.length === 1 ? "" : "s"} · ${kes(totalMrr)} MRR`} />

      <div className="card">
        <table className="data">
          <thead>
            <tr>
              <th>Landlord</th><th>Units</th><th>Joined</th><th>Status</th>
              <th style={{ textAlign: "right" }}>MRR</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/admin/landlords/${l.id}`} style={{ fontWeight: 600, color: "var(--ink)" }}>{l.businessName || l.name}</Link>
                  <div className="faint" style={{ fontSize: 12 }}>{l.email}</div>
                </td>
                <td>{l.units}</td>
                <td className="faint" style={{ fontSize: 13 }}>{new Date(l.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td><StatusBadge status={l.suspended ? "suspended" : l.billingStatus} /></td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{kes(l.mrr)}</td>
                <td style={{ textAlign: "right" }}>
                  <form action={l.suspended ? activateLandlord : suspendLandlord}>
                    <input type="hidden" name="landlordId" value={l.id} />
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }}>
                      {l.suspended ? "Reactivate" : "Suspend"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="faint" style={{ textAlign: "center", padding: 28 }}>No landlords have signed up yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
