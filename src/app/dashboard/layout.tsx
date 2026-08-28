import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { billingSummary } from "@/lib/platform-billing";
import { kes } from "@/lib/format";
import Sidebar from "./Sidebar";
import { logoutAction } from "../auth-actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const landlord = await getCurrentLandlord();
  if (!landlord) redirect("/login");
  if (landlord.suspended) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="card card-pad" style={{ maxWidth: 440, textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 34 }}>🔒</div>
          <h1 className="h1" style={{ fontSize: 20, marginTop: 8 }}>Account suspended</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>
            Your RentLink account has been suspended. Please contact support to restore access.
          </p>
          <form action={logoutAction} style={{ marginTop: 18 }}>
            <button className="btn btn-ghost">Log out</button>
          </form>
        </div>
      </div>
    );
  }

  const unmatched = await prisma.payment.count({
    where: { landlordId: landlord.id, status: "unmatched" },
  });
  const billing = await billingSummary(landlord.id);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar name={landlord.name} business={landlord.businessName || "Landlord"} unmatched={unmatched} />
      <main style={{ flex: 1, minWidth: 0, padding: "28px 32px", maxWidth: 1180 }}>
        {billing.dueNow && billing.openInvoice && (
          <Link
            href="/dashboard/billing"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              padding: "11px 16px", marginBottom: 20, borderRadius: 10,
              background: "var(--amber-tint)", border: "1px solid var(--amber)", color: "var(--amber)", fontSize: 14, fontWeight: 600,
            }}
          >
            <span>Your RentLink subscription of {kes(billing.openInvoice.amount)} is due.</span>
            <span style={{ textDecoration: "underline" }}>Pay now →</span>
          </Link>
        )}
        {billing.trialActive && billing.trialDaysLeft <= 5 && (
          <Link
            href="/dashboard/billing"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              padding: "11px 16px", marginBottom: 20, borderRadius: 10,
              background: "var(--brand-tint)", border: "1px solid var(--brand)", color: "var(--brand-dark)", fontSize: 14, fontWeight: 600,
            }}
          >
            <span>{billing.trialDaysLeft} day{billing.trialDaysLeft === 1 ? "" : "s"} left in your free trial.</span>
            <span style={{ textDecoration: "underline" }}>See billing →</span>
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}
