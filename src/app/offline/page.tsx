import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function Offline() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card card-pad" style={{ maxWidth: 400, textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 34 }}>📶</div>
        <h1 className="h1" style={{ fontSize: 20, marginTop: 8 }}>You&rsquo;re offline</h1>
        <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>
          RentLink needs a connection to show live rent and payments. Reconnect and try again.
        </p>
        <a href="/dashboard" className="btn btn-primary" style={{ marginTop: 18 }}>Retry</a>
      </div>
    </div>
  );
}
