import { requireLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kes, shortDate } from "@/lib/format";
import { PageHeader, EmptyState } from "../../ui";
import { addExpense, deleteExpense } from "../actions";

const CATEGORIES = ["repairs", "utilities", "security", "management", "other"] as const;

const CAT_LABEL: Record<string, string> = {
  repairs: "Repairs",
  utilities: "Utilities",
  security: "Security",
  management: "Management",
  other: "Other",
};

export default async function ExpensesPage() {
  const landlord = await requireLandlord();
  const properties = await prisma.property.findMany({
    where: { landlordId: landlord.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const expenses = await prisma.expense.findMany({
    where: { property: { landlordId: landlord.id } },
    orderBy: { incurredAt: "desc" },
    take: 100,
    include: { property: { select: { name: true } } },
  });

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = expenses.reduce<Record<string, number>>((m, e) => {
    m[e.category] = (m[e.category] ?? 0) + e.amount;
    return m;
  }, {});

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Track what each property costs to run — it flows straight into your P&L."
        action={
          properties.length > 0 ? (
            <details style={{ position: "relative" }}>
              <summary className="btn btn-primary" style={{ listStyle: "none" }}>+ Add expense</summary>
              <div className="card card-pad" style={{ position: "absolute", right: 0, top: 44, width: 320, zIndex: 20 }}>
                <form action={addExpense} style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label className="label">Property</label>
                    <select name="propertyId" className="select" required>
                      {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label className="label">Category</label>
                      <select name="category" className="select">
                        {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                      </select>
                    </div>
                    <div style={{ width: 120 }}>
                      <label className="label">Amount</label>
                      <input name="amount" type="number" className="input" placeholder="5000" required />
                    </div>
                  </div>
                  <div>
                    <label className="label">Date</label>
                    <input name="date" type="date" className="input" defaultValue={today} />
                  </div>
                  <div>
                    <label className="label">Note <span className="faint">(optional)</span></label>
                    <input name="note" className="input" placeholder="Plumber — B4 sink" />
                  </div>
                  <button className="btn btn-primary">Add expense</button>
                </form>
              </div>
            </details>
          ) : undefined
        }
      />

      {expenses.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <div className="card card-pad" style={{ flex: "1 1 160px" }}>
            <div className="stat-label">Total (last 100)</div>
            <div className="stat-value" style={{ marginTop: 4, color: "var(--red)" }}>{kes(total)}</div>
          </div>
          {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <div key={cat} className="card card-pad" style={{ flex: "1 1 120px" }}>
              <div className="stat-label">{CAT_LABEL[cat] || cat}</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4 }} className="mono">{kes(amt)}</div>
            </div>
          ))}
        </div>
      )}

      {properties.length === 0 ? (
        <div className="card"><EmptyState title="Add a property first" hint="Expenses attach to a property." /></div>
      ) : expenses.length === 0 ? (
        <div className="card"><EmptyState title="No expenses yet" hint="Log repairs, utilities and other costs to build your P&L." /></div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="data">
            <thead>
              <tr><th>Date</th><th>Property</th><th>Category</th><th>Note</th><th style={{ textAlign: "right" }}>Amount</th><th></th></tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td className="muted" style={{ fontSize: 13 }}>{shortDate(e.incurredAt)}</td>
                  <td style={{ fontWeight: 600 }}>{e.property.name}</td>
                  <td className="muted">{CAT_LABEL[e.category] || e.category}</td>
                  <td className="muted" style={{ fontSize: 13 }}>{e.note || "—"}</td>
                  <td style={{ textAlign: "right" }} className="mono">{kes(e.amount)}</td>
                  <td style={{ textAlign: "right" }}>
                    <form action={deleteExpense}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px", color: "var(--red)" }}>Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
