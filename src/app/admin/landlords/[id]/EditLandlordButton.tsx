"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLandlord, deleteLandlord } from "../../actions";

interface Props {
  id: string;
  name: string;
  businessName: string | null;
  email: string;
  phone: string | null;
}

export default function EditLandlordButton({ id, name, businessName, email, phone }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateLandlord, null as { ok?: boolean; error?: string } | null);
  const [confirming, setConfirming] = useState(false);
  const [delErr, setDelErr] = useState("");
  const [delPending, startDelete] = useTransition();

  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  function close() { setOpen(false); setConfirming(false); setDelErr(""); }

  return (
    <>
      <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setOpen(true)}>Edit</button>

      {open && (
        <div
          onClick={() => close()}
          style={{ position: "fixed", inset: 0, background: "rgba(20,33,27,0.55)", zIndex: 50, display: "grid", placeItems: "center", padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: "100%", maxWidth: 440, background: "var(--surface)", textAlign: "left" }}>
            <div className="h2" style={{ marginBottom: 4 }}>Edit landlord</div>
            <div className="faint" style={{ fontSize: 13, marginBottom: 16 }}>
              Contact &amp; identity only. Paybill, M-Pesa keys and password aren&rsquo;t editable here.
            </div>
            <form action={action} style={{ display: "grid", gap: 12 }}>
              <input type="hidden" name="landlordId" value={id} />
              <div>
                <label className="label">Contact name</label>
                <input name="name" className="input" defaultValue={name} required />
              </div>
              <div>
                <label className="label">Business name <span className="faint">(optional)</span></label>
                <input name="businessName" className="input" defaultValue={businessName ?? ""} placeholder="Mwangi Properties" />
              </div>
              <div>
                <label className="label">Email (login)</label>
                <input name="email" type="email" className="input mono" defaultValue={email} required />
              </div>
              <div>
                <label className="label">Phone <span className="faint">(optional)</span></label>
                <input name="phone" className="input" defaultValue={phone ?? ""} placeholder="0712 345 678" />
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
                  Delete account
                </button>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <div className="faint" style={{ fontSize: 13 }}>
                    Permanently delete <b>{businessName || name}</b> and all their data? Only empty accounts can be
                    deleted — otherwise suspend instead. This can&rsquo;t be undone.
                  </div>
                  {delErr && <div className="badge badge-red" style={{ width: "fit-content" }}>{delErr}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: "var(--red)", color: "#fff", fontSize: 13 }}
                      disabled={delPending}
                      onClick={() => startDelete(async () => {
                        const r = await deleteLandlord(id);
                        if (r.ok) { setOpen(false); router.push("/admin/landlords"); }
                        else setDelErr(r.error);
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
