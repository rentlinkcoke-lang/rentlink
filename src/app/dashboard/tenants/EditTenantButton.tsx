"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { updateTenant, deleteTenant } from "../actions";

interface Props {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export default function EditTenantButton({ id, name, phone, email }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateTenant, null as { ok?: boolean; error?: string } | null);
  const [confirming, setConfirming] = useState(false);
  const [delErr, setDelErr] = useState("");
  const [delPending, startDelete] = useTransition();

  // Close on a successful save (the table re-renders from the server).
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  function close() { setOpen(false); setConfirming(false); setDelErr(""); }

  return (
    <>
      <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setOpen(true)}>
        Edit
      </button>

      {open && (
        <div
          onClick={() => close()}
          style={{ position: "fixed", inset: 0, background: "rgba(20,33,27,0.45)", zIndex: 50, display: "grid", placeItems: "center", padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: "100%", maxWidth: 420, background: "var(--surface)", textAlign: "left" }}>
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
                <button type="button" className="btn btn-ghost" onClick={() => close()} disabled={pending}>Cancel</button>
                <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
              </div>
            </form>

            <div style={{ borderTop: "1px solid var(--border)", marginTop: 18, paddingTop: 14 }}>
              {!confirming ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 13, color: "var(--red)" }}
                  onClick={() => { setDelErr(""); setConfirming(true); }}
                >
                  Delete tenant
                </button>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <div className="faint" style={{ fontSize: 13 }}>
                    Delete <b>{name}</b>? This can&rsquo;t be undone.
                  </div>
                  {delErr && <div className="badge badge-red" style={{ width: "fit-content" }}>{delErr}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: "var(--red)", color: "#fff", fontSize: 13 }}
                      disabled={delPending}
                      onClick={() => startDelete(async () => {
                        const r = await deleteTenant(id);
                        if (r.ok) close(); else setDelErr(r.error);
                      })}
                    >
                      {delPending ? "Deleting…" : "Confirm delete"}
                    </button>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} disabled={delPending} onClick={() => setConfirming(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
