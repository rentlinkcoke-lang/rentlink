"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "../auth-actions";

const NAV: [string, string, string][] = [
  ["/dashboard", "Overview", "▤"],
  ["/dashboard/insights", "Insights", "◔"],
  ["/dashboard/properties", "Properties", "⌂"],
  ["/dashboard/tenants", "Tenants", "☺"],
  ["/dashboard/import", "Bulk import", "⇪"],
  ["/dashboard/invoices", "Rent roll", "▦"],
  ["/dashboard/payments", "Payments", "⇄"],
  ["/dashboard/arrears", "Arrears", "△"],
  ["/dashboard/expenses", "Expenses", "▽"],
  ["/dashboard/reports", "P&L", "∑"],
  ["/dashboard/messages", "Messages", "✉"],
  ["/dashboard/simulate", "Simulate M-Pesa", "◈"],
  ["/dashboard/billing", "Billing", "◆"],
  ["/dashboard/settings", "Settings", "⚙"],
];

export default function Sidebar({ name, business, unmatched }: { name: string; business: string; unmatched: number }) {
  const path = usePathname();
  return (
    <aside
      style={{
        width: 240, flexShrink: 0, borderRight: "1px solid var(--border)", background: "var(--surface)",
        height: "100vh", position: "sticky", top: 0, display: "flex", flexDirection: "column", padding: 16,
      }}
    >
      <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 19, padding: "6px 8px 18px" }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15 }}>⌂</span>
        RentLink
      </Link>

      <nav style={{ display: "grid", gap: 2 }}>
        {NAV.map(([href, label, icon]) => {
          const active = href === "/dashboard" ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9,
                fontSize: 14, fontWeight: active ? 600 : 500,
                color: active ? "var(--brand-dark)" : "var(--ink-soft)",
                background: active ? "var(--brand-tint)" : "transparent",
              }}
            >
              <span style={{ width: 16, textAlign: "center", opacity: .8 }}>{icon}</span>
              {label}
              {label === "Payments" && unmatched > 0 && (
                <span className="badge badge-red" style={{ marginLeft: "auto", fontSize: 11, padding: "1px 7px" }}>{unmatched}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
        <div className="faint" style={{ fontSize: 12, marginBottom: 10 }}>{business}</div>
        <form action={logoutAction}>
          <button className="btn btn-ghost" style={{ width: "100%", fontSize: 13, padding: "8px 12px" }}>Log out</button>
        </form>
      </div>
    </aside>
  );
}
