import { requireLandlord } from "@/lib/auth";
import { profitAndLoss } from "@/lib/reports";
import { kes, periodLabel, monthName } from "@/lib/format";
import { PageHeader, StatCard } from "../../ui";

const CAT_LABEL: Record<string, string> = {
  repairs: "Repairs", utilities: "Utilities", security: "Security", management: "Management", other: "Other",
};

// Last 12 periods as { value: "YYYY-MM", label }.
function recentPeriods(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() + 1;
  for (let i = 0; i < 12; i++) {
    out.push({ value: `${y}-${String(m).padStart(2, "0")}`, label: `${monthName(m)} ${y}` });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const landlord = await requireLandlord();
  const sp = await searchParams;

  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;
  if (sp.period && /^\d{4}-\d{2}$/.test(sp.period)) {
    const [y, m] = sp.period.split("-").map(Number);
    year = y; month = m;
  }
  const currentValue = `${year}-${String(month).padStart(2, "0")}`;

  const pnl = await profitAndLoss(landlord.id, year, month);
  const catEntries = Object.entries(pnl.expenseByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <PageHeader
        title="Profit & Loss"
        subtitle="Cash-basis: rent and utilities collected, less expenses, per property."
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <form method="get" action="/dashboard/reports" style={{ display: "flex", gap: 8 }}>
              <select name="period" className="select" defaultValue={currentValue} style={{ width: 160 }}>
                {recentPeriods().map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <button className="btn btn-ghost">View</button>
            </form>
            <a className="btn btn-primary" href={`/api/reports/pnl?period=${currentValue}`}>Export CSV</a>
          </div>
        }
      />

      <div style={{ marginBottom: 6, fontSize: 14, fontWeight: 600, color: "var(--ink-soft)" }}>{periodLabel(year, month)}</div>

      {/* portfolio summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        <StatCard label="Income collected" value={kes(pnl.totals.income)} sub={`Rent ${kes(pnl.totals.rent)} · Utilities ${kes(pnl.totals.utilities)}`} accent="green" />
        <StatCard label="Expenses" value={kes(pnl.totals.expenses)} sub="across all properties" accent={pnl.totals.expenses > 0 ? "red" : undefined} />
        <StatCard label="Net operating income" value={kes(pnl.totals.net)} sub={pnl.totals.net >= 0 ? "profit" : "loss"} accent={pnl.totals.net >= 0 ? "green" : "red"} />
        <StatCard label="Margin" value={pnl.totals.income > 0 ? `${Math.round((pnl.totals.net / pnl.totals.income) * 100)}%` : "—"} sub="net ÷ income" />
      </div>

      {/* per-property P&L */}
      <div className="card" style={{ marginTop: 20, overflowX: "auto" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }} className="h2">By property</div>
        <table className="data">
          <thead>
            <tr>
              <th>Property</th>
              <th style={{ textAlign: "right" }}>Rent</th>
              <th style={{ textAlign: "right" }}>Utilities</th>
              <th style={{ textAlign: "right" }}>Income</th>
              <th style={{ textAlign: "right" }}>Expenses</th>
              <th style={{ textAlign: "right" }}>Net</th>
            </tr>
          </thead>
          <tbody>
            {pnl.properties.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td style={{ textAlign: "right" }} className="mono muted">{kes(p.rent)}</td>
                <td style={{ textAlign: "right" }} className="mono muted">{kes(p.utilities)}</td>
                <td style={{ textAlign: "right" }} className="mono">{kes(p.income)}</td>
                <td style={{ textAlign: "right", color: "var(--red)" }} className="mono">{kes(p.expenses)}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }} className="mono">
                  <span style={{ color: p.net >= 0 ? "var(--brand-dark)" : "var(--red)" }}>{kes(p.net)}</span>
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid var(--border-strong)" }}>
              <td style={{ fontWeight: 800 }}>Portfolio total</td>
              <td style={{ textAlign: "right", fontWeight: 700 }} className="mono">{kes(pnl.totals.rent)}</td>
              <td style={{ textAlign: "right", fontWeight: 700 }} className="mono">{kes(pnl.totals.utilities)}</td>
              <td style={{ textAlign: "right", fontWeight: 700 }} className="mono">{kes(pnl.totals.income)}</td>
              <td style={{ textAlign: "right", fontWeight: 700 }} className="mono">{kes(pnl.totals.expenses)}</td>
              <td style={{ textAlign: "right", fontWeight: 800 }} className="mono">
                <span style={{ color: pnl.totals.net >= 0 ? "var(--brand-dark)" : "var(--red)" }}>{kes(pnl.totals.net)}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* expense breakdown */}
      {catEntries.length > 0 && (
        <div className="card" style={{ marginTop: 18, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }} className="h2">Expenses by category</div>
          <table className="data">
            <tbody>
              {catEntries.map(([cat, amt]) => (
                <tr key={cat}>
                  <td>{CAT_LABEL[cat] || cat}</td>
                  <td style={{ textAlign: "right" }} className="mono">{kes(amt)}</td>
                  <td style={{ textAlign: "right", width: 80 }} className="faint">{pnl.totals.expenses > 0 ? Math.round((amt / pnl.totals.expenses) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
