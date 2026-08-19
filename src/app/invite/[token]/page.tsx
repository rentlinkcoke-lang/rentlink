import { getInviteByToken } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { kes } from "@/lib/format";
import AcceptForm from "./AcceptForm";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  const valid =
    invite &&
    invite.status === "pending" &&
    (!invite.expiresAt || invite.expiresAt >= new Date()) &&
    invite.unit.leases.length === 0;

  const landlord = invite ? await prisma.landlord.findUnique({ where: { id: invite.landlordId }, select: { businessName: true, name: true } }) : null;
  const business = landlord?.businessName || landlord?.name || "your landlord";

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 20, marginBottom: 20, justifyContent: "center" }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16 }}>⌂</span>
          RentLink
        </div>

        <div className="card card-pad" style={{ padding: 28 }}>
          {!valid ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div className="h2">This invite isn't available</div>
              <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>
                {invite && invite.unit.leases.length > 0
                  ? "This unit has already been taken."
                  : invite && invite.status === "accepted"
                  ? "This invite has already been used."
                  : "The link may have expired or been withdrawn. Please ask your landlord for a new one."}
              </p>
            </div>
          ) : (
            <>
              <div className="badge badge-green" style={{ marginBottom: 14 }}>Tenancy invitation</div>
              <h1 className="h1" style={{ fontSize: 22 }}>Welcome to {invite.unit.property.name}</h1>
              <div style={{ margin: "14px 0 20px", padding: "12px 14px", background: "var(--brand-tint)", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span className="muted">Unit</span>
                  <b>{invite.unit.property.name} {invite.unit.label}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 6 }}>
                  <span className="muted">Monthly rent</span>
                  <b className="mono">{kes(invite.unit.rent)}</b>
                </div>
              </div>
              <p className="muted" style={{ fontSize: 14, marginTop: 0, marginBottom: 18 }}>
                {business} has invited you to move in. Fill in your details to confirm — it takes a few seconds.
              </p>
              <AcceptForm token={token} deposit={invite.unit.rent} />
            </>
          )}
        </div>
        <div className="faint" style={{ fontSize: 12, textAlign: "center", marginTop: 14 }}>
          Powered by RentLink · rent that reconciles itself
        </div>
      </div>
    </div>
  );
}
