// Shared presentational components (server-safe — no client hooks).
import { statusColor } from "@/lib/format";

export function Badge({ status, label }: { status: string; label?: string }) {
  const color = statusColor(status);
  return <span className={`badge badge-${color}`}>{label ?? status}</span>;
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "amber" | "red";
}) {
  return (
    <div className="card card-pad">
      <div className="stat-label">{label}</div>
      <div
        className="stat-value"
        style={{ marginTop: 6, color: accent ? `var(--${accent})` : "var(--ink)" }}
      >
        {value}
      </div>
      {sub && <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div className="h2" style={{ color: "var(--ink-soft)" }}>{title}</div>
      {hint && <div className="faint" style={{ marginTop: 6, fontSize: 14 }}>{hint}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <div className="muted" style={{ marginTop: 4, fontSize: 14 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
