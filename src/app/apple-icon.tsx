import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon: house mark on a forest-green rounded tile.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(150deg,#1f9d4d,#0f3d24)",
        }}
      >
        <svg width="104" height="104" viewBox="0 0 24 24" fill="none">
          <path d="M3 11.5 L12 3.5 L21 11.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 10 L5.5 20 L18.5 20 L18.5 10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
