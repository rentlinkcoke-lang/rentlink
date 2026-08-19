import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kes } from "@/lib/format";
import { Badge, PageHeader, EmptyState } from "../../../ui";
import { createUnit, createTenantAndLease, addUtility, endLease, createInviteAction, revokeInviteAction } from "../../actions";

export default async function PropertyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const landlord = await requireLandlord();
  const property = await prisma.property.findFirst({
    where: { id, landlordId: landlord.id },
    include: {
      units: {
        orderBy: { label: "asc" },
        include: {
          leases: {
            where: { status: "active" },
            include: {
              tenant: true,
              invoices: { where: { status: { in: ["pending", "partial", "overdue"] } }, select: { amount: true, amountPaid: true } },
            },
          },
          invites: { where: { status: "pending" }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!property) notFound();

  const paybill = landlord.paybill || "4109210";
  const appBase = process.env.APP_BASE_URL || "http://localhost:3000";

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <Link href="/dashboard/properties" className="faint" style={{ fontSize: 13 }}>← Properties</Link>
      </div>
      <PageHeader
        title={property.name}
        subtitle={`${property.location || "—"} · Paybill ${paybill} · code ${property.code}`}
        action={
          <details style={{ position: "relative" }}>
            <summary className="btn btn-primary" style={{ listStyle: "none" }}>+ Add unit</summary>
            <div className="card card-pad" style={{ position: "absolute", right: 0, top: 44, width: 300, zIndex: 20 }}>
              <form action={createUnit} style={{ display: "grid", gap: 12 }}>
                <input type="hidden" name="propertyId" value={property.id} />
                <div>
                  <label className="label">Unit label</label>
                  <input name="label" className="input" placeholder="B4" required />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">Rent (KES)</label>
                    <input name="rent" type="number" className="input" placeholder="25000" required />
                  </div>
                  <div style={{ width: 90 }}>
                    <label className="label">Beds</label>
                    <input name="bedrooms" type="number" className="input" placeholder="2" />
                  </div>
                </div>
                <button className="btn btn-primary">Add unit</button>
              </form>
            </div>
          </details>
        }
      />

      {property.units.length === 0 ? (
        <div className="card"><EmptyState title="No units yet" hint="Add units — each gets a unique M-Pesa reference automatically." /></div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {property.units.map((u) => {
            const lease = u.leases[0];
            const invite = u.invites[0];
            const inviteLink = invite ? `${appBase}/invite/${invite.token}` : null;
            const balance = lease ? lease.invoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0) : 0;
            return (
              <div key={u.id} className="card card-pad">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  {/* left: unit + ref */}
                  <div style={{ minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="h2">{u.label}</span>
                      {lease ? <Badge status="active" label="occupied" /> : <Badge status="slate" label="vacant" />}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13 }} className="muted">Rent {kes(u.rent)}/mo</div>
                    <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--brand-tint)", borderRadius: 8, display: "inline-block" }}>
                      <span className="faint" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>Pay to Paybill {paybill}, Acct</span>
                      <div className="mono" style={{ fontWeight: 700, color: "var(--brand-dark)", fontSize: 16 }}>{u.payRef}</div>
                    </div>
                  </div>

                  {/* middle: tenant */}
                  <div style={{ minWidth: 200, flex: 1 }}>
                    {lease ? (
                      <>
                        <div className="faint" style={{ fontSize: 12 }}>Tenant</div>
                        <div style={{ fontWeight: 600 }}>{lease.tenant.name}</div>
                        <div className="muted mono" style={{ fontSize: 13 }}>{lease.tenant.phone}</div>
                        <div style={{ marginTop: 10 }}>
                          <span className="faint" style={{ fontSize: 12 }}>Balance </span>
                          <span className="mono" style={{ fontWeight: 700, color: balance > 0 ? "var(--red)" : "var(--brand-dark)" }}>{kes(balance)}</span>
                        </div>
                      </>
                    ) : inviteLink ? (
                      <>
                        <div className="faint" style={{ fontSize: 12 }}>Invite sent — awaiting tenant</div>
                        <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <input readOnly value={inviteLink} className="input mono" style={{ fontSize: 12, padding: "6px 8px", maxWidth: 220 }} />
                          <a href={inviteLink} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }}>Open</a>
                        </div>
                      </>
                    ) : (
                      <div className="faint" style={{ fontSize: 13 }}>No active tenant</div>
                    )}
                  </div>

                  {/* right: actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    {!lease ? (
                      <>
                        <details style={{ position: "relative" }}>
                          <summary className="btn btn-ghost" style={{ listStyle: "none" }}>Assign tenant</summary>
                          <div className="card card-pad" style={{ position: "absolute", right: 0, top: 44, width: 280, zIndex: 20 }}>
                            <form action={createTenantAndLease} style={{ display: "grid", gap: 10 }}>
                              <input type="hidden" name="unitId" value={u.id} />
                              <div><label className="label">Name</label><input name="name" className="input" placeholder="Wanjiku Kamau" required /></div>
                              <div><label className="label">M-Pesa phone</label><input name="phone" className="input" placeholder="0712 345 678" required /></div>
                              <div><label className="label">Deposit (KES)</label><input name="deposit" type="number" className="input" placeholder="25000" /></div>
                              <button className="btn btn-primary">Create lease</button>
                            </form>
                          </div>
                        </details>
                        {invite ? (
                          <form action={revokeInviteAction}>
                            <input type="hidden" name="inviteId" value={invite.id} />
                            <input type="hidden" name="propertyId" value={property.id} />
                            <button className="btn btn-ghost" style={{ fontSize: 13, color: "var(--red)" }}>Revoke invite</button>
                          </form>
                        ) : (
                          <form action={createInviteAction}>
                            <input type="hidden" name="unitId" value={u.id} />
                            <button className="btn btn-primary" style={{ fontSize: 13 }}>Invite tenant</button>
                          </form>
                        )}
                      </>
                    ) : (
                      <>
                        <details style={{ position: "relative" }}>
                          <summary className="btn btn-ghost" style={{ listStyle: "none" }}>+ Utility bill</summary>
                          <div className="card card-pad" style={{ position: "absolute", right: 0, top: 44, width: 240, zIndex: 20 }}>
                            <form action={addUtility} style={{ display: "grid", gap: 10 }}>
                              <input type="hidden" name="leaseId" value={lease.id} />
                              <div><label className="label">Type</label>
                                <select name="type" className="select">
                                  <option value="water">Water</option>
                                  <option value="electricity">Electricity</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                              <div><label className="label">Amount (KES)</label><input name="amount" type="number" className="input" placeholder="800" required /></div>
                              <button className="btn btn-primary">Add charge</button>
                            </form>
                          </div>
                        </details>
                        <form action={endLease}>
                          <input type="hidden" name="leaseId" value={lease.id} />
                          <button className="btn btn-ghost" style={{ fontSize: 13, color: "var(--red)" }}>End lease</button>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
