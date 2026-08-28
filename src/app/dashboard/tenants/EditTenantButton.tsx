"use client";

import { useActionState, useEffect, useState } from "react";
import { updateTenant } from "../actions";

interface Props {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export default function EditTenantButton({ id, name, phone, email }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateTenant, null as { ok?: boolean; error?: string } | null);

  // Close on a successful save (the table re-renders from the server).
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setOpen(true)}>
        Edit
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(20,33,27,0.45)", zIndex: 50,
            display: "grid", placeItems: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card card-pad"
            style={{ width: "100%", maxWidth: 420, background: "var(--surface)" }}
          >
            <div className="h2" style={{ marginBottom: 4 }}>Edit tenant</div>
            <div className="faint" style={{ fontSize: 13, marginBottom: 16 }}>
              Updating contact details only — this does not change their unit or lease.
            </div>
            <form action={action} style={{ display: "grid", gap: 12 }}>
              <input type="hidden" name="tenantId" value={id} />
              <div>
                <label className="label">Full name</label>
                <input name="name" className="input" defaultValue={name} required />
              </div>
              <div>
                <label className="label">Phone (M-Pesa)</label>
                <input name="phone" className="input mono" defaultValue={phone} placeholder="2547XXXXXXXX" required />
              </div>
              <div>
                <label className="label">Email <span className="faint">(optional)</span></label>
                <input name="email" type="email" className="input" defaultValue={email ?? ""} placeholder="tenant@example.com" />
              </div>
              {state?.error && <div className="badge badge-red" style={{ width: "fit-content" }}>{state.error}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
                <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
