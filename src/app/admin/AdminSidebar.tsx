"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "../auth-actions";

const NAV: [string, string, string][] = [
  ["/admin", "Overview", "◵"],
  ["/admin/landlords", "Landlords", "☖"],
];

function Mark() {
  return (
    <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15 }}>⌂</span>
  );
}

export default function AdminSidebar({ name, email }: { name: string; email: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [path]);

  return (
    <>
      {/* mobile top bar */}
      <div className="rl-admin-topbar">
        <button className="rl-admin-burger" aria-label="Open menu" onClick={() => setOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 800, fontSize: 17, color: "#fff" }}>
          <Mark /> RentLink
        </Link>
        <span style={{ marginLeft: "auto", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "#6b8090", fontWeight: 700 }}>Admin</span>
      </div>

      {open && <div className="rl-scrim" onClick={() => setOpen(false)} />}

      <aside className={`rl-admin-aside${open ? " rl-open" : ""}`}>
        <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 19, padding: "6px 8px 6px", color: "#fff" }}>
          <Mark /> RentLink
        </Link>
        <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#6b8090", padding: "0 8px 16px", fontWeight: 700 }}>
          Platform admin
        </div>

        <nav style={{ display: "grid", gap: 2 }}>
          {NAV.map(([href, label, icon]) => {
            const active = href === "/admin" ? path === href : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9,
                  fontSize: 14, fontWeight: active ? 600 : 500,
                  color: active ? "#fff" : "#9fb0bc",
                  background: active ? "#1c2b36" : "transparent",
                }}
              >
                <span style={{ width: 16, textAlign: "center", opacity: .8 }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", borderTop: "1px solid #23303a", paddingTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{name}</div>
          <div style={{ fontSize: 12, marginBottom: 10, color: "#6b8090" }}>{email}</div>
          <form action={logoutAction}>
            <button className="btn btn-ghost" style={{ width: "100%", fontSize: 13, padding: "8px 12px", background: "#1c2b36", borderColor: "#23303a", color: "#cdd8df" }}>Log out</button>
          </form>
        </div>
      </aside>
    </>
  );
}
