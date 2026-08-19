import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { billingSummary } from "@/lib/platform-billing";
import { kes } from "@/lib/format";
import Sidebar from "./Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const landlord = await getCurrentLandlord();
  if (!landlord) redirect("/login");

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
