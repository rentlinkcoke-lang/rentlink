"use client";

import { useActionState, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { runImport } from "../actions";
import { IMPORT_TEMPLATE } from "@/lib/import";

interface Prop { id: string; name: string; code: string }

// Sample rows for the downloadable .xlsx — same shape the importer reads.
const SAMPLE: (string | number)[][] = [
  ["property", "label", "rent", "bedrooms", "tenant_name", "tenant_phone", "tenant_email", "deposit"],
  ["Bloom Court", "A1", 25000, 2, "Mary Achieng", "0712345678", "mary@example.com", 25000],
  ["Bloom Court", "A2", 25000, 2, "", "", "", ""],
  ["Bloom Court", "Shop 1", 40000, 0, "Kamau Stores", "0720000000", "", 40000],
  ["Riverside Flats", "B1", 32000, 3, "John Otieno", "0733000000", "john@example.com", 32000],
  ["Riverside Flats", "B2", 32000, 3, "", "", "", ""],
];

export default function ImportForm({ properties }: { properties: Prop[] }) {
  const [state, action, pending] = useActionState(runImport, null as Awaited<ReturnType<typeof runImport>> | null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const text = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (!text.trim()) { setParseError("That sheet looks empty."); return; }
      setCsv(text);
      setFileName(file.name);
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

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
      <form action={action} className="card card-pad" style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="label" style={{ marginBottom: 2 }}>1. Start from the sample</div>
            <div className="faint" style={{ fontSize: 12 }}>Fill it in Excel, then upload it back.</div>
          </div>
          <button type="button" className="btn btn-ghost" onClick={downloadSample}>⬇ Download sample .xlsx</button>
        </div>

        <div>
          <label className="label">2. Upload your file</label>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            style={{ fontSize: 14 }}
          />
          {fileName && (
            <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
              Loaded <b>{fileName}</b> — review below, then import.
            </div>
          )}
          {parseError && <div className="badge badge-red" style={{ width: "fit-content", marginTop: 8 }}>{parseError}</div>}
        </div>

        <div>
          <label className="label">Default property (optional)</label>
          <select name="propertyId" className="select" defaultValue="">
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
            name="csv"
            className="input mono"
            rows={10}
            style={{ resize: "vertical", lineHeight: 1.5 }}
            placeholder={IMPORT_TEMPLATE}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
            Columns: <span className="mono">property, label, rent, bedrooms, tenant_name, tenant_phone, tenant_email, deposit</span>.
            Leave tenant fields blank for a vacant unit.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" disabled={pending || !csv.trim()}>{pending ? "Importing…" : "Import"}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setCsv(IMPORT_TEMPLATE)}>Load sample rows</button>
        </div>
        {state?.error && <div className="badge badge-red" style={{ width: "fit-content" }}>{state.error}</div>}
      </form>

      <div className="card" style={{ overflow: "hidden", minHeight: 120 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }} className="h2">Result</div>
        {!state?.result ? (
          <div className="faint" style={{ padding: 28, textAlign: "center", fontSize: 14 }}>
            Upload your file or paste rows, then import to see the result here.
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 18, padding: "16px 18px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              <Stat label="Properties" value={state.result.propertiesCreated} />
              <Stat label="Units" value={state.result.unitsCreated} />
              <Stat label="Tenants" value={state.result.tenantsCreated} />
              <Stat label="Skipped" value={state.result.skipped} amber={state.result.skipped > 0} />
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

function Stat({ label, value, amber }: { label: string; value: number; amber?: boolean }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div style={{ fontWeight: 700, fontSize: 20, color: amber ? "var(--amber)" : "var(--brand-dark)" }}>{value}</div>
    </div>
  );
}
