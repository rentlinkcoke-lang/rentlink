"use client";

import { useActionState } from "react";
import { runImport } from "../actions";
import { IMPORT_TEMPLATE } from "@/lib/import";

interface Prop { id: string; name: string; code: string }

export default function ImportForm({ properties }: { properties: Prop[] }) {
  const [state, action, pending] = useActionState(runImport, null as Awaited<ReturnType<typeof runImport>> | null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
      <form action={action} className="card card-pad" style={{ display: "grid", gap: 14 }}>
        <div>
          <label className="label">Import into property</label>
          <select name="propertyId" className="select" required defaultValue={properties[0]?.id}>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </select>
        </div>
        <div>
          <label className="label">CSV rows</label>
          <textarea
            name="csv"
            className="input mono"
            rows={12}
            style={{ resize: "vertical", lineHeight: 1.5 }}
            placeholder={IMPORT_TEMPLATE}
            defaultValue=""
          />
          <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
            Columns: <span className="mono">label, rent, bedrooms, tenant_name, tenant_phone, tenant_email, deposit</span>.
            A header row is optional. Leave tenant fields blank for a vacant unit.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" disabled={pending}>{pending ? "Importing…" : "Import"}</button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={(e) => {
              const ta = (e.currentTarget.closest("form") as HTMLFormElement).querySelector("textarea");
              if (ta) (ta as HTMLTextAreaElement).value = IMPORT_TEMPLATE;
            }}
          >
            Load sample
          </button>
        </div>
        {state?.error && <div className="badge badge-red" style={{ width: "fit-content" }}>{state.error}</div>}
      </form>

      <div className="card" style={{ overflow: "hidden", minHeight: 120 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }} className="h2">Result</div>
        {!state?.result ? (
          <div className="faint" style={{ padding: 28, textAlign: "center", fontSize: 14 }}>
            Paste your rows and import to see the result here.
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 18, padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
              <div><div className="stat-label">Units</div><div style={{ fontWeight: 700, fontSize: 20, color: "var(--brand-dark)" }}>{state.result.unitsCreated}</div></div>
              <div><div className="stat-label">Tenants</div><div style={{ fontWeight: 700, fontSize: 20, color: "var(--brand-dark)" }}>{state.result.tenantsCreated}</div></div>
              <div><div className="stat-label">Skipped</div><div style={{ fontWeight: 700, fontSize: 20, color: state.result.skipped ? "var(--amber)" : "var(--ink-faint)" }}>{state.result.skipped}</div></div>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {state.result.rows.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "9px 18px", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span className="mono faint" style={{ minWidth: 42 }}>row {r.line}</span>
                  <span className="dot" style={{ marginTop: 6, background: r.status === "created" ? "var(--brand)" : "var(--amber)" }} />
                  <span className="muted">{r.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
