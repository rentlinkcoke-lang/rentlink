"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "../auth-actions";

const NAV: [string, string, string][] = [
  ["/admin", "Overview", "◵"],
  ["/admin/landlords", "Landlords", "☖"],
];

export default function AdminSidebar({ name, email }: { name: string; email: string }) {
  const path = usePathname();
  return (
    <aside
      style={{
        width: 240, flexShrink: 0, borderRight: "1px solid #23303a", background: "#0f1a22",
        height: "100vh", position: "sticky", top: 0, display: "flex", flexDirection: "column", padding: 16, color: "#cdd8df",
      }}
    >
      <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 19, padding: "6px 8px 6px", color: "#fff" }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15 }}>⌂</span>
        RentLink
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
  );
}
