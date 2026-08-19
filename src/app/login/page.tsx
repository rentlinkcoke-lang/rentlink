"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "../auth-actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null as { error?: string } | null);
  return (
    <AuthShell title="Welcome back" subtitle="Log in to your RentLink dashboard.">
      <form action={action} style={{ display: "grid", gap: 14 }}>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" className="input" placeholder="you@example.com" defaultValue="demo@rentlink.co.ke" required />
        </div>
        <div>
          <label className="label">Password</label>
          <input name="password" type="password" className="input" placeholder="••••••••" defaultValue="demo1234" required />
        </div>
        {state?.error && <div className="badge badge-red" style={{ width: "fit-content" }}>{state.error}</div>}
        <button className="btn btn-primary" disabled={pending} style={{ marginTop: 4 }}>
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>
      <div className="muted" style={{ fontSize: 14, marginTop: 18 }}>
        New here? <Link href="/register" style={{ color: "var(--brand-dark)", fontWeight: 600 }}>Create an account</Link>
      </div>
      <div className="faint" style={{ fontSize: 12, marginTop: 16, padding: 10, background: "var(--bg)", borderRadius: 8 }}>
        Demo login is pre-filled: <b>demo@rentlink.co.ke</b> / <b>demo1234</b>
      </div>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 20, marginBottom: 24, justifyContent: "center" }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16 }}>⌂</span>
          RentLink
        </Link>
        <div className="card card-pad" style={{ padding: 28 }}>
          <h1 className="h1" style={{ fontSize: 22 }}>{title}</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 6, marginBottom: 20 }}>{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
