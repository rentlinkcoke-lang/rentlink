"use client";

import { useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { planImportAction, commitImportAction } from "../actions";
import { IMPORT_TEMPLATE, type ImportPlan, type ImportResult, type PlanItem } from "@/lib/import";

interface Prop { id: string; name: string; code: string }

const SAMPLE: (string | number)[][] = [
  ["property", "label", "rent", "bedrooms", "tenant_name", "tenant_phone", "tenant_email", "deposit"],
  ["Bloom Court", "A1", 25000, 2, "Mary Achieng", "0712345678", "mary@example.com", 25000],
  ["Bloom Court", "A2", 25000, 2, "", "", "", ""],
  ["Bloom Court", "Shop 1", 40000, 0, "Kamau Stores", "0720000000", "", 40000],
  ["Riverside Flats", "B1", 32000, 3, "John Otieno", "0733000000", "john@example.com", 32000],
  ["Riverside Flats", "B2", 32000, 3, "", "", "", ""],
];

export default function ImportForm({ properties }: { properties: Prop[] }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [parseError, setParseError] = useState("");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { blankrows: false });
      if (!text.trim()) { setParseError("That sheet looks empty."); return; }
      setCsv(text);
      setFileName(file.name);
      setResult(null);
    } catch {
      setParseError("Couldn't read that file. Use .xlsx, .xls or .csv.");
    }
  }

  function downloadSample() {
    const ws = XLSX.utils.aoa_to_sheet(SAMPLE);
    ws["!cols"] = [{ wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 9 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 9 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Units");
    XLSX.writeFile(wb, "rentlink-import-template.xlsx");
  }

  function preview() {
    setError("");
    startTransition(async () => {
      const res = await planImportAction(propertyId, csv);
      if (!res.ok) { setError(res.error); return; }
      setPlan(res.plan);
      setConfirmed(new Set()); // approvals start empty — landlord opts in per tenant
      setResult(null);
    });
  }

  function commit() {
    startTransition(async () => {
      const res = await commitImportAction(propertyId, csv, [...confirmed]);
      if (!res.ok) { setError(res.error); return; }
      setResult(res.result);
      setPlan(null);
    });
  }

  function toggle(line: number) {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line); else next.add(line);
      return next;
    });
  }

  const confirmRows = plan ? plan.items.filter((i) => i.needsConfirm) : [];
  const allConfirmed = confirmRows.length > 0 && confirmRows.every((i) => confirmed.has(i.line));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
      {/* ---------------- LEFT: input or preview ---------------- */}
      {!plan ? (
        <div className="card card-pad" style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="label" style={{ marginBottom: 2 }}>1. Start from the sample</div>
              <div className="faint" style={{ fontSize: 12 }}>Fill it in Excel, then upload it back.</div>
            </div>
            <button type="button" className="btn btn-ghost" onClick={downloadSample}>⬇ Download sample .xlsx</button>
          </div>

          <div>
            <label className="label">2. Upload your file</label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ fontSize: 14 }} />
            {fileName && <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>Loaded <b>{fileName}</b>.</div>}
            {parseError && <div className="badge badge-red" style={{ width: "fit-content", marginTop: 8 }}>{parseError}</div>}
          </div>

          <div>
            <label className="label">Default property (optional)</label>
            <select className="select" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              <option value="">Use the “property” column in my file</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
            <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
              Rows with a blank property go into this one. Named properties are created automatically.
            </div>
          </div>

          <div>
            <label className="label">3. Review the rows</label>
            <textarea
              className="input mono" rows={9} style={{ resize: "vertical", lineHeight: 1.5 }}
              placeholder={IMPORT_TEMPLATE} value={csv} onChange={(e) => setCsv(e.target.value)}
            />
            <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
              Columns: <span className="mono">property, label, rent, bedrooms, tenant_name, tenant_phone, tenant_email, deposit</span>.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" disabled={pending || !csv.trim()} onClick={preview}>
              {pending ? "Checking…" : "Preview import →"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setCsv(IMPORT_TEMPLATE)}>Load sample rows</button>
          </div>
          {error && <div className="badge badge-red" style={{ width: "fit-content" }}>{error}</div>}
        </div>
      ) : (
        <div className="card card-pad" style={{ display: "grid", gap: 14 }}>
          <div>
            <div className="h2">Review before importing</div>
            <div className="faint" style={{ fontSize: 13, marginTop: 4 }}>
              New units and tenants will be added. Anything that changes an <b>existing tenancy</b> is
              highlighted — tick to approve it, or leave it unticked to skip.
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
            <Tag color="var(--green)" text={`${plan.newUnits} new unit${plan.newUnits === 1 ? "" : "s"}`} />
            <Tag color="var(--brand)" text={`${plan.newTenants} new tenant${plan.newTenants === 1 ? "" : "s"}`} />
            {plan.confirmations > 0 && <Tag color="var(--amber)" text={`${plan.confirmations} need${plan.confirmations === 1 ? "s" : ""} your OK`} />}
            {plan.invalid > 0 && <Tag color="var(--red)" text={`${plan.invalid} invalid`} />}
          </div>

          {plan.propertiesToCreate.length > 0 && (
            <div className="faint" style={{ fontSize: 12 }}>New properties: {plan.propertiesToCreate.join(", ")}</div>
          )}

          {confirmRows.length > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--amber)" }}>
              <input
                type="checkbox" checked={allConfirmed}
                onChange={() => setConfirmed(allConfirmed ? new Set() : new Set(confirmRows.map((i) => i.line)))}
              />
              Approve all {confirmRows.length} change{confirmRows.length === 1 ? "" : "s"} to existing tenancies
            </label>
          )}

          <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            {plan.items.map((it) => (
              <PlanRow key={it.line} it={it} checked={confirmed.has(it.line)} onToggle={() => toggle(it.line)} />
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" disabled={pending} onClick={commit}>
              {pending ? "Importing…" : "Commit import"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setPlan(null)}>← Back</button>
          </div>
          {error && <div className="badge badge-red" style={{ width: "fit-content" }}>{error}</div>}
        </div>
      )}

      {/* ---------------- RIGHT: result ---------------- */}
      <div className="card" style={{ overflow: "hidden", minHeight: 120 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }} className="h2">Result</div>
        {!result ? (
          <div className="faint" style={{ padding: 28, textAlign: "center", fontSize: 14 }}>
            {plan ? "Approve the highlighted rows, then commit." : "Upload your file, then Preview to see exactly what will change."}
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 16, padding: "16px 18px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              <Stat label="Properties" value={result.propertiesCreated} />
              <Stat label="Units" value={result.unitsCreated} />
              <Stat label="Tenants added" value={result.tenantsCreated} />
              <Stat label="Tenants updated" value={result.tenantsUpdated} />
              <Stat label="Skipped" value={result.skipped} amber={result.skipped > 0} />
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {result.rows.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "9px 18px", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span className="mono faint" style={{ minWidth: 42 }}>row {r.line}</span>
                  <span className="dot" style={{ marginTop: 6, background: r.status === "skipped" ? "var(--amber)" : "var(--brand)" }} />
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

function PlanRow({ it, checked, onToggle }: { it: PlanItem; checked: boolean; onToggle: () => void }) {
  const meta = actionMeta(it.action);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)", background: it.needsConfirm ? "var(--amber-tint)" : undefined }}>
      {it.needsConfirm ? (
        <input type="checkbox" checked={checked} onChange={onToggle} style={{ marginTop: 3 }} />
      ) : (
        <span style={{ width: 13 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {it.property} · {it.label || "—"} {it.tenant && <span className="faint" style={{ fontWeight: 400 }}>· {it.tenant}</span>}
        </div>
        <div className="faint" style={{ fontSize: 12 }}>{it.note}</div>
      </div>
      <span className={`badge badge-${meta.color}`} style={{ whiteSpace: "nowrap" }}>{meta.label}</span>
    </div>
  );
}

function actionMeta(a: PlanItem["action"]): { label: string; color: string } {
  switch (a) {
    case "new-unit": return { label: "New", color: "green" };
    case "assign-existing": return { label: "Assign — confirm", color: "amber" };
    case "update-tenant": return { label: "Existing — confirm", color: "amber" };
    case "invalid": return { label: "Invalid", color: "red" };
    default: return { label: "No change", color: "slate" };
  }
}

function Tag({ color, text }: { color: string; text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className="dot" style={{ background: color }} /> {text}
    </span>
  );
}

function Stat({ label, value, amber }: { label: string; value: number; amber?: boolean }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div style={{ fontWeight: 700, fontSize: 20, color: amber ? "var(--amber)" : "var(--brand-dark)" }}>{value}</div>
    </div>
  );
}
