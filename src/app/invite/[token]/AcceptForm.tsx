"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "../actions";

export default function AcceptForm({ token, deposit }: { token: string; deposit: number }) {
  const [state, action, pending] = useActionState(acceptInviteAction, null as { ok?: boolean; error?: string } | null);

  if (state?.ok) {
    return (
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <div style={{ fontSize: 40 }}>🎉</div>
        <div className="h2" style={{ marginTop: 8 }}>You're all set!</div>
        <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
          Your tenancy is confirmed. Your first rent invoice is on its way by SMS
          {" "}— pay it via M-Pesa and you'll get a receipt instantly.
        </p>
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label">Full name</label>
        <input name="name" className="input" placeholder="e.g. Mary Achieng" required />
      </div>
      <div>
        <label className="label">M-Pesa phone</label>
        <input name="phone" className="input" placeholder="0712 345 678" required />
      </div>
      <div>
        <label className="label">Email <span className="faint">(optional)</span></label>
        <input name="email" type="email" className="input" placeholder="you@example.com" />
      </div>
      {deposit > 0 && (
        <input type="hidden" name="deposit" value={deposit} />
      )}
      {state?.error && <div className="badge badge-red" style={{ width: "fit-content" }}>{state.error}</div>}
      <button className="btn btn-primary" disabled={pending} style={{ marginTop: 4, padding: "12px" }}>
        {pending ? "Confirming…" : "Confirm my tenancy"}
      </button>
      <div className="faint" style={{ fontSize: 12, textAlign: "center" }}>
        By confirming, you agree to receive rent invoices and receipts on this number.
      </div>
    </form>
  );
}
