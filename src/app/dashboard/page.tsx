import Link from "next/link";
import { requireLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dashboardStats, arrearsList } from "@/lib/stats";
import { sweepOverdue } from "@/lib/invoices";
import { kes, kesShort, periodLabel, timeAgo } from "@/lib/format";
import { StatCard, Badge, PageHeader, EmptyState } from "../ui";
import { runBilling } from "./actions";

export default async function Overview() {
  const landlord = await requireLandlord();
  await sweepOverdue(landlord.id);

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const stats = await dashboardStats(landlord.id, year, month);
  const arrears = (await arrearsList(landlord.id)).slice(0, 5);
  const recentPayments = await prisma.payment.findMany({
    where: { landlordId: landlord.id },
    orderBy: { receivedAt: "desc" },
    take: 6,
    include: { allocations: { include: { invoice: true } } },
  });

  const noData = stats.totalUnits === 0;

  return (
    <div>
      <PageHeader
        title={`${periodLabel(year, month)} at a glance`}
        subtitle={landlord.businessName || landlord.name}
        action={
          !noData ? (
            <form action={runBilling}>
              <button className="btn btn-ghost">Generate this month's rent</button>
            </form>
          ) : undefined
        }
      />

      {noData ? (
        <div className="card">
          <EmptyState
            title="Let's set up your first property"
            hint="Add a property and its units, then a tenant — RentLink gives every unit an M-Pesa reference and reconciles rent automatically."
          />
          <div style={{ textAlign: "center", paddingBottom: 32 }}>
            <Link href="/dashboard/properties" className="btn btn-primary">Add a property →</Link>
          </div>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
            <StatCard label="Collected this month" value={kesShort(stats.collectedThisMonth)} sub={`${stats.collectionRate}% of ${kesShort(stats.billedThisMonth)} billed`} accent="green" />
            <StatCard label="Outstanding arrears" value={kesShort(stats.arrears)} sub="across all open invoices" accent={stats.arrears > 0 ? "red" : undefined} />
            <StatCard label="Occupancy" value={`${stats.occupancy}%`} sub={`${stats.occupied} of ${stats.totalUnits} units let`} />
            <StatCard label="In suspense" value={String(stats.unmatchedCount)} sub={stats.unmatchedCount ? `${kes(stats.unmatchedAmount)} to reconcile` : "all payments matched"} accent={stats.unmatchedCount ? "amber" : undefined} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 20 }}>
            {/* recent payments */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div className="h2">Recent payments</div>
                <Link href="/dashboard/payments" className="faint" style={{ fontSize: 13 }}>View all →</Link>
              </div>
              {recentPayments.length === 0 ? (
                <EmptyState title="No payments yet" hint="Try the M-Pesa simulator to see reconciliation in action." />
              ) : (
                <table className="data">
                  <tbody>
                    {recentPayments.map((p) => {
                      const applied = p.allocations[0]?.invoice;
                      return (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{p.payerName || p.payerPhone}</div>
                            <div className="faint mono" style={{ fontSize: 12 }}>{p.payRef} · {timeAgo(p.receivedAt)}</div>
                          </td>
                          <td className="muted" style={{ fontSize: 13 }}>
                            {applied ? `${periodLabel(applied.periodYear, applied.periodMonth)} ${applied.type}` : "—"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div className="mono" style={{ fontWeight: 600 }}>{kes(p.amount)}</div>
                            <Badge status={p.status} label={p.status === "matched" ? "matched" : "suspense"} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* arrears */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div className="h2">Top arrears</div>
                <Link href="/dashboard/arrears" className="faint" style={{ fontSize: 13 }}>View all →</Link>
              </div>
              {arrears.length === 0 ? (
                <EmptyState title="No arrears" hint="Every tenant is up to date." />
              ) : (
                <table className="data">
                  <tbody>
                    {arrears.map((a) => (
                      <tr key={a.leaseId}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{a.tenant}</div>
                          <div className="faint" style={{ fontSize: 12 }}>{a.unit} · {a.months} mo</div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="mono" style={{ fontWeight: 600, color: "var(--red)" }}>{kes(a.balance)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
