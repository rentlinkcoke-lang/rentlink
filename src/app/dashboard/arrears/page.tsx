import { requireLandlord } from "@/lib/auth";
import { sweepOverdue } from "@/lib/invoices";
import { arrearsList } from "@/lib/stats";
import { kes } from "@/lib/format";
import { PageHeader, EmptyState } from "../../ui";
import { sendReminder, sendAllReminders, requestStkPayment } from "../actions";

export default async function ArrearsPage() {
  const landlord = await requireLandlord();
  await sweepOverdue(landlord.id);
  const rows = await arrearsList(landlord.id);
  const total = rows.reduce((s, r) => s + r.balance, 0);

  // WhatsApp reminder link builder (click-to-chat).
  const reminderLink = (phone: string, name: string, unit: string, balance: number) => {
    const msg = `Hi ${name.split(" ")[0]}, a gentle reminder that your rent for ${unit} has an outstanding balance of ${kes(balance)}. Kindly pay via M-Pesa to clear it. Asante — ${landlord.businessName || "RentLink"}.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div>
      <PageHeader
        title="Arrears"
        subtitle={`${rows.length} tenant${rows.length === 1 ? "" : "s"} owing ${kes(total)} in total.`}
        action={
          rows.length > 0 ? (
            <form action={sendAllReminders}>
              <button className="btn btn-primary">SMS all reminders</button>
            </form>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <div className="card"><EmptyState title="No arrears 🎉" hint="Every active tenant is fully paid up." /></div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="data">
            <thead>
              <tr><th>Tenant</th><th>Unit</th><th>Months open</th><th style={{ textAlign: "right" }}>Balance</th><th style={{ textAlign: "right" }}>Remind</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.leaseId}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.tenant}</div>
                    <div className="faint mono" style={{ fontSize: 12 }}>{r.phone}</div>
                  </td>
                  <td className="muted">{r.unit}</td>
                  <td className="muted">{r.months}</td>
                  <td style={{ textAlign: "right" }} className="mono">
                    <span style={{ fontWeight: 700, color: "var(--red)" }}>{kes(r.balance)}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end" }}>
                      <form action={requestStkPayment}>
                        <input type="hidden" name="leaseId" value={r.leaseId} />
                        <button className="btn btn-primary" style={{ fontSize: 13, padding: "6px 12px" }}>Request via M-Pesa</button>
                      </form>
                      <form action={sendReminder}>
                        <input type="hidden" name="leaseId" value={r.leaseId} />
                        <button className="btn btn-ghost" style={{ fontSize: 13, padding: "6px 12px" }}>SMS</button>
                      </form>
                      <a href={reminderLink(r.phone, r.tenant, r.unit, r.balance)} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: 13, padding: "6px 12px" }}>
                        WhatsApp
                      </a>
                    </div>
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
