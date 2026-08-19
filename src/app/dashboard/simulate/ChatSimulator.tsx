"use client";

import { useState } from "react";
import { simulateWhatsAppInbound } from "../actions";

interface Tenant {
  name: string;
  phone: string;
  unit: string;
}
interface Line {
  from: "tenant" | "bot";
  text: string;
}

export default function ChatSimulator({ tenants }: { tenants: Tenant[] }) {
  const [phone, setPhone] = useState(tenants[0]?.phone || "254712345678");
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, setPending] = useState(false);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || pending) return;
    setDraft("");
    setLines((l) => [...l, { from: "tenant", text: msg }]);
    setPending(true);
    const fd = new FormData();
    fd.set("phone", phone);
    fd.set("text", msg);
    const res = await simulateWhatsAppInbound(null, fd);
    setPending(false);
    setLines((l) => [...l, { from: "bot", text: res.reply || res.error || "…" }]);
  }

  const current = tenants.find((t) => t.phone === phone);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ background: "#075e54", color: "#fff", padding: "14px 18px" }}>
        <div style={{ fontWeight: 700 }}>WhatsApp · pay-in-chat</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>Simulate a tenant messaging your business number</div>
      </div>

      <div className="card-pad" style={{ borderBottom: "1px solid var(--border)" }}>
        <label className="label">Message as</label>
        <select className="select" value={phone} onChange={(e) => { setPhone(e.target.value); setLines([]); }}>
          {tenants.map((t) => (
            <option key={t.phone} value={t.phone}>{t.name} — {t.unit} ({t.phone})</option>
          ))}
          {tenants.length === 0 && <option value="254712345678">254712345678 (no tenants yet)</option>}
        </select>
      </div>

      {/* chat window */}
      <div style={{ background: "#e5ddd5", minHeight: 240, maxHeight: 340, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {lines.length === 0 && (
          <div style={{ textAlign: "center", color: "#667", fontSize: 13, margin: "auto" }}>
            Send <b>PAY</b> or <b>BALANCE</b> {current ? `as ${current.name}` : ""} to start.
          </div>
        )}
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              alignSelf: l.from === "tenant" ? "flex-end" : "flex-start",
              background: l.from === "tenant" ? "#dcf8c6" : "#fff",
              color: "#111",
              padding: "8px 11px",
              borderRadius: 10,
              maxWidth: "82%",
              fontSize: 13.5,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              boxShadow: "0 1px 1px rgba(0,0,0,.08)",
            }}
          >
            {l.text}
          </div>
        ))}
        {pending && <div style={{ alignSelf: "flex-start", color: "#667", fontSize: 12 }}>typing…</div>}
      </div>

      {/* composer */}
      <div className="card-pad" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 10px" }} onClick={() => send("BALANCE")} disabled={pending}>BALANCE</button>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 10px" }} onClick={() => send("PAY")} disabled={pending}>PAY</button>
        <input
          className="input"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(draft); }}
        />
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => send(draft)} disabled={pending}>Send</button>
      </div>
    </div>
  );
}
