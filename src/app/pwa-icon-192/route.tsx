import { ImageResponse } from "next/og";

// 192px maskable PWA icon — house mark on a forest tile with safe-zone padding.
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1f9d4d" }}>
        <svg width="112" height="112" viewBox="0 0 24 24" fill="none">
          <path d="M3 11.5 L12 3.5 L21 11.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 10 L5.5 20 L18.5 20 L18.5 10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
