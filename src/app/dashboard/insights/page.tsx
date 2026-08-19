import { requireLandlord } from "@/lib/auth";
import { sweepOverdue } from "@/lib/invoices";
import { monthlyTrend, arrearsAging, occupancyBreakdown } from "@/lib/analytics";
import { profitAndLoss } from "@/lib/reports";
import { kes, kesShort, periodLabel } from "@/lib/format";
import { PageHeader, StatCard } from "../../ui";

export default async function InsightsPage() {
  const landlord = await requireLandlord();
  await sweepOverdue(landlord.id);

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const trend = await monthlyTrend(landlord.id, 6);
  const aging = await arrearsAging(landlord.id);
  const occ = await occupancyBreakdown(landlord.id);
  const pnl = await profitAndLoss(landlord.id, year, month);

  const current = trend[trend.length - 1];
  const performers = [...pnl.properties].sort((a, b) => b.net - a.net);
  const maxBilled = Math.max(1, ...trend.map((t) => t.billed));
  const maxAging = Math.max(1, ...aging.buckets.map((b) => b.amount));

  return (
    <div>
      <PageHeader title="Insights" subtitle="The numbers that tell you where to push to grow the portfolio." />

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        <StatCard label="Collection rate" value={`${current.rate}%`} sub={`${periodLabel(current.year, current.month)} (in progress)`} accent={current.rate >= 80 ? "green" : current.rate >= 50 ? "amber" : "red"} />
        <StatCard label="Occupancy" value={`${occ.occupancyPct}%`} sub={`${occ.occupied}/${occ.totalUnits} units let`} />
        <StatCard label="Vacancy loss" value={`${kesShort(occ.vacancyLoss)}/mo`} sub={`${occ.vacant} vacant unit${occ.vacant === 1 ? "" : "s"}`} accent={occ.vacancyLoss > 0 ? "amber" : undefined} />
        <StatCard label="Total arrears" value={kesShort(aging.total)} sub="outstanding balances" accent={aging.total > 0 ? "red" : undefined} />
      </div>

      {/* collection trend */}
      <div className="card card-pad" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div className="h2">Billed vs collected</div>
          <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
            <span className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--border-strong)" }} /> Billed</span>
            <span className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--brand)" }} /> Collected</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end", height: 190, marginTop: 20 }}>
          {trend.map((t) => (
            <div key={`${t.year}-${t.month}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
              <div className="mono faint" style={{ fontSize: 11 }}>{t.rate}%</div>
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 150, width: "100%", justifyContent: "center" }}>
                <div title={`Billed ${kes(t.billed)}`} style={{ width: "38%", maxWidth: 26, height: `${Math.max(2, (t.billed / maxBilled) * 100)}%`, background: "var(--border-strong)", borderRadius: "4px 4px 0 0" }} />
                <div title={`Collected ${kes(t.collected)}`} style={{ width: "38%", maxWidth: 26, height: `${Math.max(2, (t.collected / maxBilled) * 100)}%`, background: "var(--brand)", borderRadius: "4px 4px 0 0" }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: t.current ? 700 : 500, color: t.current ? "var(--ink)" : "var(--ink-soft)" }}>
                {t.label}{t.current ? " ·" : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        {/* arrears aging */}
        <div className="card card-pad">
          <div className="h2">Arrears aging</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2, marginBottom: 18 }}>How overdue the {kes(aging.total)} owed is.</div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 150 }}>
            {aging.buckets.map((b) => (
              <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div className="mono faint" style={{ fontSize: 11 }}>{b.amount ? kesShort(b.amount) : ""}</div>
                <div style={{ width: "100%", display: "flex", justifyContent: "center", height: 100, alignItems: "flex-end" }}>
                  <div title={kes(b.amount)} style={{ width: 28, height: `${Math.max(2, (b.amount / maxAging) * 100)}%`, background: b.label === "Not due" ? "var(--slate)" : b.label === "90d+" ? "var(--red)" : "var(--amber)", borderRadius: "4px 4px 0 0" }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)", textAlign: "center" }}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* occupancy */}
        <div className="card card-pad">
          <div className="h2">Occupancy</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2, marginBottom: 18 }}>
            {occ.occupied} let, {occ.vacant} vacant — {kes(occ.vacancyLoss)}/mo in lost rent.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {occ.perProperty.map((p) => (
              <div key={p.name}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span className="muted">{p.occupied}/{p.total} · {p.pct}%</span>
                </div>
                <div style={{ height: 12, background: "var(--bg)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <div style={{ width: `${p.pct}%`, height: "100%", background: "var(--brand)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* property performance */}
      <div className="card" style={{ marginTop: 16, overflowX: "auto" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }} className="h2">Property performance — {periodLabel(year, month)}</div>
        <table className="data">
          <thead>
            <tr><th>Property</th><th style={{ textAlign: "right" }}>Income</th><th style={{ textAlign: "right" }}>Expenses</th><th style={{ textAlign: "right" }}>Net</th><th style={{ textAlign: "right" }}>Margin</th></tr>
          </thead>
          <tbody>
            {performers.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td style={{ textAlign: "right" }} className="mono muted">{kes(p.income)}</td>
                <td style={{ textAlign: "right", color: "var(--red)" }} className="mono">{kes(p.expenses)}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }} className="mono">
                  <span style={{ color: p.net >= 0 ? "var(--brand-dark)" : "var(--red)" }}>{kes(p.net)}</span>
                </td>
                <td style={{ textAlign: "right" }} className="mono muted">{p.income > 0 ? `${Math.round((p.net / p.income) * 100)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
