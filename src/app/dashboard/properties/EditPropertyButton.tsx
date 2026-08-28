"use client";

import { useActionState, useEffect, useState } from "react";
import { updateProperty } from "../actions";

interface Props {
  id: string;
  name: string;
  location: string | null;
  code: string;
}

export default function EditPropertyButton({ id, name, location, code }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateProperty, null as { ok?: boolean; error?: string } | null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <button
        className="btn btn-ghost"
        style={{ fontSize: 12, padding: "4px 10px", background: "var(--surface)" }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
      >
        Edit
      </button>

      {open && (
        <div
          onClick={(e) => { e.preventDefault(); setOpen(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(20,33,27,0.45)", zIndex: 50, display: "grid", placeItems: "center", padding: 20 }}
        >
          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="card card-pad" style={{ width: "100%", maxWidth: 420, background: "var(--surface)", textAlign: "left" }}>
            <div className="h2" style={{ marginBottom: 4 }}>Edit property</div>
            <div className="faint" style={{ fontSize: 13, marginBottom: 16 }}>
              Code <span className="mono" style={{ fontWeight: 600 }}>{code}</span> can&rsquo;t change — it prefixes every unit&rsquo;s M-Pesa reference.
            </div>
            <form action={action} style={{ display: "grid", gap: 12 }}>
              <input type="hidden" name="propertyId" value={id} />
              <div>
                <label className="label">Property name</label>
                <input name="name" className="input" defaultValue={name} required />
              </div>
              <div>
                <label className="label">Location <span className="faint">(optional)</span></label>
                <input name="location" className="input" defaultValue={location ?? ""} placeholder="Kilimani, Nairobi" />
              </div>
              {state?.error && <div className="badge badge-red" style={{ width: "fit-content" }}>{state.error}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={(e) => { e.preventDefault(); setOpen(false); }} disabled={pending}>Cancel</button>
                <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
