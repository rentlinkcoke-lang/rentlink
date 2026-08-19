"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "../auth-actions";
import { AuthShell } from "../login/page";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerAction, null as { error?: string } | null);
  return (
    <AuthShell title="Create your account" subtitle="Start collecting rent that reconciles itself.">
      <form action={action} style={{ display: "grid", gap: 14 }}>
        <div>
          <label className="label">Your name</label>
          <input name="name" className="input" placeholder="Jane Mwangi" required />
        </div>
        <div>
          <label className="label">Business name <span className="faint">(optional)</span></label>
          <input name="businessName" className="input" placeholder="Mwangi Properties" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" className="input" placeholder="you@example.com" required />
        </div>
        <div>
          <label className="label">Password</label>
          <input name="password" type="password" className="input" placeholder="At least 6 characters" required />
        </div>
        {state?.error && <div className="badge badge-red" style={{ width: "fit-content" }}>{state.error}</div>}
        <button className="btn btn-primary" disabled={pending} style={{ marginTop: 4 }}>
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
      <div className="muted" style={{ fontSize: 14, marginTop: 18 }}>
        Already have an account? <Link href="/login" style={{ color: "var(--brand-dark)", fontWeight: 600 }}>Log in</Link>
      </div>
    </AuthShell>
  );
}
