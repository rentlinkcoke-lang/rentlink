"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { updateUnit, deleteUnit } from "../../actions";

interface Props {
  id: string;
  label: string;
  rent: number;
  bedrooms: number | null;
  payRef: string;
  occupied: boolean;
}

export default function EditUnitButton({ id, label, rent, bedrooms, payRef, occupied }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateUnit, null as { ok?: boolean; error?: string } | null);
  const [confirming, setConfirming] = useState(false);
  const [delErr, setDelErr] = useState("");
  const [delPending, startDelete] = useTransition();

  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  function close() { setOpen(false); setConfirming(false); setDelErr(""); }

  return (
    <>
      <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setOpen(true)}>Edit unit</button>

      {open && (
        <div
          onClick={() => close()}
          style={{ position: "fixed", inset: 0, background: "rgba(20,33,27,0.45)", zIndex: 50, display: "grid", placeItems: "center", padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: "100%", maxWidth: 420, background: "var(--surface)", textAlign: "left" }}>
            <div className="h2" style={{ marginBottom: 4 }}>Edit unit</div>
            <div className="faint" style={{ fontSize: 13, marginBottom: 16 }}>
              M-Pesa reference <span className="mono" style={{ fontWeight: 600 }}>{payRef}</span> stays the same, even if you rename the unit.
            </div>
            <form action={action} style={{ display: "grid", gap: 12 }}>
              <input type="hidden" name="unitId" value={id} />
              <div>
                <label className="label">Unit label</label>
                <input name="label" className="input" defaultValue={label} required />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Rent (KES)</label>
                  <input name="rent" type="number" className="input" defaultValue={rent} required />
                </div>
                <div style={{ width: 100 }}>
                  <label className="label">Bedrooms</label>
                  <input name="bedrooms" type="number" className="input" defaultValue={bedrooms ?? ""} placeholder="—" />
                </div>
              </div>
              {occupied && (
                <div className="faint" style={{ fontSize: 12 }}>
                  This sets the unit&rsquo;s standard rent. The current tenant&rsquo;s active lease keeps its agreed rent.
                </div>
              )}
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
                  Delete unit
                </button>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <div className="faint" style={{ fontSize: 13 }}>Delete unit <b>{label}</b>? This can&rsquo;t be undone.</div>
                  {delErr && <div className="badge badge-red" style={{ width: "fit-content" }}>{delErr}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: "var(--red)", color: "#fff", fontSize: 13 }}
                      disabled={delPending}
                      onClick={() => startDelete(async () => {
                        const r = await deleteUnit(id);
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
