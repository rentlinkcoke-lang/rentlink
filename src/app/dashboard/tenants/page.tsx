import { requireLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kes } from "@/lib/format";
import { Badge, PageHeader, EmptyState } from "../../ui";

export default async function TenantsPage() {
  const landlord = await requireLandlord();
  const tenants = await prisma.tenant.findMany({
    where: { landlordId: landlord.id },
    orderBy: { name: "asc" },
    include: {
      leases: {
        include: {
          unit: { include: { property: true } },
          invoices: { where: { status: { in: ["pending", "partial", "overdue"] } }, select: { amount: true, amountPaid: true } },
        },
      },
    },
  });

  return (
    <div>
      <PageHeader title="Tenants" subtitle="Everyone renting a unit, with live balances." />
      {tenants.length === 0 ? (
        <div className="card"><EmptyState title="No tenants yet" hint="Assign a tenant to a unit from a property page." /></div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="data">
            <thead>
              <tr><th>Tenant</th><th>Phone</th><th>Unit</th><th>Status</th><th style={{ textAlign: "right" }}>Balance</th></tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const active = t.leases.find((l) => l.status === "active");
                const balance = active ? active.invoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0) : 0;
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td className="mono muted">{t.phone}</td>
                    <td className="muted">{active ? `${active.unit.property.name} ${active.unit.label}` : "—"}</td>
                    <td>{active ? <Badge status="active" label="active" /> : <Badge status="slate" label="past" />}</td>
                    <td style={{ textAlign: "right" }} className="mono">
                      <span style={{ fontWeight: 600, color: balance > 0 ? "var(--red)" : "var(--ink-soft)" }}>{kes(balance)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
