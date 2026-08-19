import { requireLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sweepOverdue } from "@/lib/invoices";
import { kes, periodLabel, shortDate } from "@/lib/format";
import { Badge, PageHeader, EmptyState } from "../../ui";
import { runBilling } from "../actions";

export default async function InvoicesPage() {
  const landlord = await requireLandlord();
  await sweepOverdue(landlord.id);

  const invoices = await prisma.invoice.findMany({
    where: { lease: { unit: { property: { landlordId: landlord.id } } } },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: { lease: { include: { tenant: true, unit: { include: { property: true } } } } },
  });

  return (
    <div>
      <PageHeader
        title="Rent roll"
        subtitle="Every invoice raised, rent and utilities."
        action={
          <form action={runBilling}>
            <button className="btn btn-primary">Generate this month's rent</button>
          </form>
        }
      />
      {invoices.length === 0 ? (
        <div className="card"><EmptyState title="No invoices yet" hint="Assign tenants and generate rent to populate the roll." /></div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="data">
            <thead>
              <tr><th>Period</th><th>Tenant / Unit</th><th>Type</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>Paid</th><th>Due</th><th>Status</th></tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 600 }}>{periodLabel(i.periodYear, i.periodMonth)}</td>
                  <td>
                    <div>{i.lease.tenant.name}</div>
                    <div className="faint" style={{ fontSize: 12 }}>{i.lease.unit.property.name} {i.lease.unit.label}</div>
                  </td>
                  <td className="muted" style={{ textTransform: "capitalize" }}>{i.type}</td>
                  <td style={{ textAlign: "right" }} className="mono">{kes(i.amount)}</td>
                  <td style={{ textAlign: "right" }} className="mono muted">{kes(i.amountPaid)}</td>
                  <td className="muted" style={{ fontSize: 13 }}>{shortDate(i.dueDate)}</td>
                  <td><Badge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
