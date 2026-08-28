import { ImageResponse } from "next/og";

export const alt = "RentLink — rent that reconciles itself";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social share card. Forest ground echoing the app's dark FlowDemo surface,
// the house mark + wordmark, the thesis headline, and the payRef motif.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 76px",
          background: "linear-gradient(150deg,#0f3d24 0%,#0a2c1b 62%,#08251a 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 62,
              height: 62,
              borderRadius: 15,
              background: "#1f9d4d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <path d="M3 11.5 L12 3.5 L21 11.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.5 10 L5.5 20 L18.5 20 L18.5 10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>RentLink</div>
        </div>

        {/* thesis */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, maxWidth: 900 }}>
            Rent that reconciles itself.
          </div>
          <div style={{ fontSize: 30, color: "#9cc0a8", maxWidth: 860, lineHeight: 1.35 }}>
            Every unit gets its own M-Pesa reference — the tenant pays, and it marks itself paid.
          </div>
        </div>

        {/* footer row: payRef chip + pricing */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "rgba(92,206,127,0.14)",
              border: "1px solid rgba(92,206,127,0.4)",
              borderRadius: 12,
              padding: "14px 22px",
            }}
          >
            <span style={{ fontSize: 22, color: "#9cc0a8" }}>Paybill · Acct</span>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#6fe08f", letterSpacing: 1 }}>BLOOMB4</span>
          </div>
          <div style={{ fontSize: 24, color: "#9cc0a8" }}>Property management for Kenya</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
