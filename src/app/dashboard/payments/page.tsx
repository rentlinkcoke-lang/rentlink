import Link from "next/link";
import { requireLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kes, dateTime, periodLabel } from "@/lib/format";
import { Badge, PageHeader, EmptyState } from "../../ui";
import { manualReconcile } from "../actions";

export default async function PaymentsPage() {
  const landlord = await requireLandlord();
  const payments = await prisma.payment.findMany({
    where: { landlordId: landlord.id },
    orderBy: { receivedAt: "desc" },
    take: 100,
    include: { allocations: { include: { invoice: true } } },
  });

  const receipts = await prisma.receipt.findMany({
    where: { paymentId: { in: payments.map((p) => p.id) } },
  });
  const receiptByPayment = new Map(receipts.map((r) => [r.paymentId, r]));

  const unmatched = payments.filter((p) => p.status === "unmatched");

  // Recent STK Push requests (request-to-pay).
  const stkRequests = await prisma.stkRequest.findMany({
    where: { landlordId: landlord.id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const stkStatus = (s: string) =>
    s === "success" ? { st: "matched", label: "paid" }
    : s === "failed" ? { st: "unmatched", label: "failed" }
    : s === "simulated" ? { st: "amber", label: "simulated" }
    : { st: "slate", label: "prompt sent" };

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="M-Pesa C2B payments, reconciled automatically by reference."
        action={<Link href="/dashboard/simulate" className="btn btn-primary">Simulate a payment</Link>}
      />

      {unmatched.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 18, borderColor: "var(--amber)", background: "var(--amber-tint)" }}>
          <div className="h2" style={{ color: "var(--amber)" }}>⚠ {unmatched.length} payment{unmatched.length > 1 ? "s" : ""} in suspense</div>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>These couldn't be matched to a unit — usually a wrong or missing account reference. Assign the correct reference below.</div>
        </div>
      )}

      {stkRequests.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }} className="h2">M-Pesa payment requests (STK)</div>
          <table className="data">
            <tbody>
              {stkRequests.map((s) => {
                const st = stkStatus(s.status);
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.tenantName || s.tenantPhone}</div>
                      <div className="faint mono" style={{ fontSize: 12 }}>{s.unitPayRef} · {dateTime(s.createdAt)}</div>
                    </td>
                    <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>{kes(s.amount)}</td>
                    <td style={{ textAlign: "right" }}><Badge status={st.st} label={st.label} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="card"><EmptyState title="No payments yet" hint="Use the simulator to send a test M-Pesa payment through the engine." /></div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {payments.map((p) => {
            const receipt = receiptByPayment.get(p.id);
            return (
              <div key={p.id} className="card card-pad">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{p.payerName || p.payerPhone}</span>
                      <Badge status={p.status} label={p.status === "matched" ? "matched" : "suspense"} />
                    </div>
                    <div className="faint mono" style={{ fontSize: 12, marginTop: 4 }}>
                      {p.mpesaCode} · ref {p.payRef} · {dateTime(p.receivedAt)}
                    </div>
                    {p.allocations.length > 0 && (
                      <div style={{ marginTop: 10, display: "grid", gap: 3 }}>
                        {p.allocations.map((a) => (
                          <div key={a.id} className="muted" style={{ fontSize: 13 }}>
                            → {periodLabel(a.invoice.periodYear, a.invoice.periodMonth)} {a.invoice.type} · <span className="mono">{kes(a.amount)}</span>
                          </div>
                        ))}
                        {p.amountUnallocated > 0 && (
                          <div className="muted" style={{ fontSize: 13 }}>→ credit on account · <span className="mono">{kes(p.amountUnallocated)}</span></div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{kes(p.amount)}</div>
                  </div>
                </div>

                {/* matched → show receipt; unmatched → reconcile form */}
                {p.status === "matched" && receipt && (
                  <details style={{ marginTop: 12 }}>
                    <summary className="faint" style={{ fontSize: 13, cursor: "pointer" }}>View WhatsApp receipt →</summary>
                    <pre style={{
                      marginTop: 10, background: "#075e54", color: "#e9ffe9", padding: 14, borderRadius: 10,
                      fontSize: 13, whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.5, maxWidth: 420,
                    }}>{receipt.body}</pre>
                  </details>
                )}
                {p.status === "unmatched" && (
                  <form action={manualReconcile} style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <input type="hidden" name="paymentId" value={p.id} />
                    <div style={{ maxWidth: 200 }}>
                      <label className="label">Correct reference</label>
                      <input name="payRef" className="input mono" placeholder="BLOOMB4" defaultValue={p.payRef} required />
                    </div>
                    <button className="btn btn-primary">Reconcile</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
