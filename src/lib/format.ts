// Client-safe formatters. NO next/headers or server-only imports here so both
// client and server components can use them.

export function kes(amount: number): string {
  return "KES " + amount.toLocaleString("en-KE");
}

export function kesShort(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return "KES " + (amount / 1_000_000).toFixed(1) + "M";
  if (Math.abs(amount) >= 1_000) return "KES " + (amount / 1_000).toFixed(0) + "K";
  return "KES " + amount.toLocaleString("en-KE");
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthName(m: number): string {
  return MONTHS[(m - 1 + 12) % 12];
}

export function periodLabel(year: number, month: number): string {
  return `${monthName(month)} ${year}`;
}

export function shortDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export function dateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-KE", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function timeAgo(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(date);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function statusColor(status: string): string {
  switch (status) {
    case "paid":
    case "matched":
    case "active":
    case "green":
      return "green";
    case "partial":
    case "amber":
      return "amber";
    case "overdue":
    case "unmatched":
    case "red":
      return "red";
    default:
      return "slate";
  }
}
