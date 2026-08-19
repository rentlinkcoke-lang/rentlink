import { requireLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kes } from "@/lib/format";
import { PageHeader } from "../../ui";
import { simulatePayment } from "../actions";
import ChatSimulator from "./ChatSimulator";

export default async function SimulatePage() {
  const landlord = await requireLandlord();
  const paybill = landlord.paybill || "4109210";

  const units = await prisma.unit.findMany({
    where: { property: { landlordId: landlord.id } },
    orderBy: { payRef: "asc" },
    include: {
      property: true,
      leases: { where: { status: "active" }, include: { tenant: true, invoices: { where: { status: { in: ["pending", "partial", "overdue"] } } } } },
    },
  });

  // Tenants (with active leases) for the pay-in-chat simulator.
  const chatTenants = units
    .filter((u) => u.leases[0])
    .map((u) => ({
      name: u.leases[0].tenant.name,
      phone: u.leases[0].tenant.phone,
      unit: `${u.property.name} ${u.label}`,
    }));

  return (
    <div>
      <PageHeader
        title="Simulate an M-Pesa payment"
        subtitle="Stand in for Safaricom's C2B confirmation callback. Pick a reference, enter an amount, and watch RentLink reconcile it."
      />

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20, alignItems: "start" }}>
        {/* the "phone" */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ background: "var(--brand)", color: "#fff", padding: "16px 20px", fontWeight: 700 }}>
            M-PESA · Pay Bill
          </div>
          <div className="card-pad">
            <form action={simulatePayment} style={{ display: "grid", gap: 14 }}>
              <div>
                <label className="label">Business no. (Paybill)</label>
                <input className="input mono" value={paybill} readOnly style={{ background: "var(--bg)" }} />
              </div>
              <div>
                <label className="label">Account no. (the unit reference)</label>
                <input name="payRef" className="input mono" placeholder="BLOOMB4" required list="refs" />
                <datalist id="refs">
                  {units.map((u) => <option key={u.id} value={u.payRef} />)}
                </datalist>
              </div>
              <div>
                <label className="label">Amount (KES)</label>
                <input name="amount" type="number" className="input" placeholder="25000" required />
              </div>
              <div>
                <label className="label">Payer phone</label>
                <input name="phone" className="input mono" defaultValue="254712345678" />
              </div>
              <div>
                <label className="label">Payer name <span className="faint">(optional)</span></label>
                <input name="name" className="input" placeholder="Leave blank to use tenant name" />
              </div>
              <button className="btn btn-primary" style={{ padding: "12px" }}>Send payment →</button>
            </form>
          </div>
        </div>

        {/* quick-fill reference list */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }} className="h2">Your unit references</div>
          <table className="data">
            <thead>
              <tr><th>Reference</th><th>Unit</th><th>Tenant</th><th style={{ textAlign: "right" }}>Owed now</th></tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const lease = u.leases[0];
                const owed = lease ? lease.invoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0) : 0;
                return (
                  <tr key={u.id}>
                    <td className="mono" style={{ fontWeight: 700, color: "var(--brand-dark)" }}>{u.payRef}</td>
                    <td className="muted">{u.property.name} {u.label}</td>
                    <td className="muted">{lease ? lease.tenant.name : <span className="faint">vacant</span>}</td>
                    <td style={{ textAlign: "right" }} className="mono">{lease ? kes(owed) : "—"}</td>
                  </tr>
                );
              })}
              {units.length === 0 && (
                <tr><td colSpan={4} className="faint" style={{ textAlign: "center", padding: 30 }}>Add units first.</td></tr>
              )}
            </tbody>
          </table>
          <div className="card-pad faint" style={{ fontSize: 13, borderTop: "1px solid var(--border)" }}>
            Tip: type a <b>wrong</b> reference to see how unmatched payments land in suspense on the Payments page.
          </div>
        </div>
      </div>

      {/* pay-in-chat */}
      <div style={{ marginTop: 34 }}>
        <PageHeader
          title="Pay-in-chat"
          subtitle="A tenant WhatsApps your business number — RentLink identifies them, answers, and fires the M-Pesa prompt. Reply PAY to run the whole loop."
        />
        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 20, alignItems: "start" }}>
          <ChatSimulator tenants={chatTenants} />
          <div className="card card-pad">
            <div className="h2">How it works</div>
            <ol className="muted" style={{ fontSize: 14, lineHeight: 1.7, paddingLeft: 18, marginTop: 8 }}>
              <li>Tenant messages your WhatsApp number (any text).</li>
              <li>RentLink matches their phone to their unit &amp; balance.</li>
              <li><b>BALANCE</b> replies with what they owe.</li>
              <li><b>PAY</b> fires an STK Push to their phone for the balance.</li>
              <li>They enter their M-Pesa PIN → it reconciles → receipt is sent back in the chat.</li>
            </ol>
            <div className="faint" style={{ fontSize: 13, marginTop: 10, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              In dry-run, the STK prompt is auto-approved so you can watch the full loop. The bot's replies and the
              receipt appear on the <b>Messages</b> page; the payment lands on <b>Payments</b>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
