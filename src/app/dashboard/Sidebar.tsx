"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

function Mark() {
  return (
    <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15 }}>⌂</span>
  );
}

export default function Sidebar({ name, business, unmatched }: { name: string; business: string; unmatched: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [path]);

  return (
    <>
      {/* mobile top bar */}
      <div className="rl-topbar">
        <button className="rl-burger" aria-label="Open menu" onClick={() => setOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 800, fontSize: 17 }}>
          <Mark /> RentLink
        </Link>
        {unmatched > 0 && (
          <Link href="/dashboard/payments" className="badge badge-red" style={{ marginLeft: "auto", fontSize: 11 }}>{unmatched} to match</Link>
        )}
      </div>

      {/* scrim */}
      {open && <div className="rl-scrim" onClick={() => setOpen(false)} />}

      {/* sidebar / drawer */}
      <aside className={`rl-aside${open ? " rl-open" : ""}`}>
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 19, padding: "6px 8px 18px" }}>
          <Mark /> RentLink
        </Link>

        <nav style={{ display: "grid", gap: 2, overflowY: "auto" }}>
          {NAV.map(([href, label, icon]) => {
            const active = href === "/dashboard" ? path === href : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
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
    </>
  );
}
