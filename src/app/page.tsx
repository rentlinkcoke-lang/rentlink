import Link from "next/link";
import { getSessionLandlordId } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Landing() {
  const session = await getSessionLandlordId();
  if (session) redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh" }}>
      <JsonLd />
      {/* nav */}
      <header
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", maxWidth: 1120, margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 20 }}>
          <Logo />
          RentLink
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/login" className="btn btn-ghost">Log in</Link>
          <Link href="/register" className="btn btn-primary">Start free</Link>
        </div>
      </header>

      {/* hero */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "56px 24px 40px" }}>
        <div style={{ maxWidth: 720 }}>
          <div className="badge badge-green" style={{ marginBottom: 18 }}>
            <span className="dot" style={{ background: "var(--brand)" }} /> Built for M-Pesa
          </div>
          <h1 style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
            Rent that reconciles itself.
          </h1>
          <p style={{ fontSize: 19, color: "var(--ink-soft)", marginTop: 20, lineHeight: 1.5 }}>
            Give every unit its own M-Pesa reference. The tenant pays, and RentLink instantly
            knows <b style={{ color: "var(--ink)" }}>who</b> paid, for <b style={{ color: "var(--ink)" }}>which unit</b>,
            for <b style={{ color: "var(--ink)" }}>which month</b> — then WhatsApps the receipt.
            The landlord does nothing.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
            <Link href="/register" className="btn btn-primary" style={{ padding: "13px 22px", fontSize: 15 }}>
              Start free →
            </Link>
            <Link href="/login" className="btn btn-ghost" style={{ padding: "13px 22px", fontSize: 15 }}>
              See the demo
            </Link>
          </div>
          <div className="faint" style={{ marginTop: 14, fontSize: 13 }}>
            KES 75 / unit / month · no setup fee · eTIMS &amp; KRA-ready
          </div>
        </div>

        {/* the killer-feature illustration */}
        <div className="card" style={{ marginTop: 48, padding: 0, overflow: "hidden", maxWidth: 760 }}>
          <FlowDemo />
        </div>
      </section>

      {/* value props */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 24px 72px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          {[
            ["Auto-reconciliation", "Payments match to the right unit, tenant and invoice the instant they land — no spreadsheet."],
            ["Arrears you can see", "Every tenant's balance, ranked worst-first, updated in real time as money comes in."],
            ["Receipts on autopilot", "The tenant gets a WhatsApp receipt the moment they pay. No more 'have you received my rent?'"],
            ["Water & power billing", "Add utility charges to any unit; they roll into the same M-Pesa reference and statement."],
            ["Owner & caretaker portals", "Give owners read-only books and caretakers a maintenance queue — coming in the roadmap."],
            ["KRA & eTIMS ready", "Rental-income figures and compliance reporting sit on top of clean, reconciled data."],
          ].map(([t, d]) => (
            <div key={t} className="card card-pad">
              <div className="h2">{t}</div>
              <div className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--border)", padding: "24px" }}>
        <div className="faint" style={{ maxWidth: 1120, margin: "0 auto", fontSize: 13 }}>
          RentLink · property management for Kenya · rent that reconciles itself
        </div>
      </footer>
    </div>
  );
}

function JsonLd() {
  const SITE = "https://rentlink.co.ke";
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: "RentLink",
        url: SITE,
        logo: `${SITE}/icon`,
        description: "Property management software for the Kenyan market, built around M-Pesa auto-reconciliation.",
        areaServed: { "@type": "Country", name: "Kenya" },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: SITE,
        name: "RentLink",
        publisher: { "@id": `${SITE}/#organization` },
        inLanguage: "en-KE",
      },
      {
        "@type": "SoftwareApplication",
        name: "RentLink",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: SITE,
        description:
          "Give every unit its own M-Pesa reference so rent reconciles itself and WhatsApp receipts send automatically.",
        offers: {
          "@type": "Offer",
          price: "75",
          priceCurrency: "KES",
          description: "Per unit, per month. No setup fee.",
        },
        areaServed: { "@type": "Country", name: "Kenya" },
        publisher: { "@id": `${SITE}/#organization` },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function Logo() {
  return (
    <span style={{
      width: 30, height: 30, borderRadius: 8, background: "var(--brand)",
      display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16,
    }}>⌂</span>
  );
}

function FlowDemo() {
  const steps = [
    { k: "Tenant pays", v: "Paybill 4109210 · Acct BLOOMB4", sub: "KES 25,000" },
    { k: "RentLink resolves", v: "Wanjiku → Bloom Court B4", sub: "August rent" },
    { k: "Marked paid", v: "Invoice reconciled automatically", sub: "0 balance" },
    { k: "Receipt sent", v: "WhatsApp → 0712 345 678", sub: "instant" },
  ];
  return (
    <div style={{ background: "linear-gradient(180deg,#0e1a13,#132218)", padding: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        {steps.map((s, i) => (
          <div key={s.k} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 12, padding: 16,
          }}>
            <div style={{ color: "#6fe08f", fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>
              {i + 1}. {s.k}
            </div>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 600, marginTop: 8 }}>{s.v}</div>
            <div style={{ color: "#9fb7a8", fontSize: 13, marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
