import { requireLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { onfonConfigured } from "@/lib/sms";
import { resendConfigured } from "@/lib/email";
import { whatsappConfigured } from "@/lib/whatsapp";
import { dateTime } from "@/lib/format";
import { Badge, PageHeader, EmptyState } from "../../ui";

const KIND_LABEL: Record<string, string> = {
  invoice: "Invoice",
  receipt: "Receipt",
  reminder: "Reminder",
  manual: "Manual",
  chat: "Chat",
};

function ChannelChip({ channel }: { channel: string }) {
  const map: Record<string, [string, string]> = {
    sms: ["SMS", "var(--slate)"],
    whatsapp: ["WhatsApp", "var(--brand)"],
    email: ["Email", "#4f5fb0"],
  };
  const [label, color] = map[channel] || ["SMS", "var(--slate)"];
  return (
    <span className="badge" style={{ background: "var(--slate-tint)", color: "var(--ink-soft)", display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span className="dot" style={{ background: color, width: 7, height: 7 }} />
      {label}
    </span>
  );
}

function ChannelStatus({ name, live, envHint }: { name: string; live: boolean; envHint: string }) {
  return (
    <div
      className="card card-pad"
      style={{
        borderColor: live ? "var(--brand)" : "var(--amber)",
        background: live ? "var(--brand-tint)" : "var(--amber-tint)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span className="dot" style={{ background: live ? "var(--brand)" : "var(--amber)", width: 10, height: 10 }} />
        <div style={{ fontWeight: 700, color: live ? "var(--brand-dark)" : "var(--amber)" }}>
          {name} — {live ? "live" : "dry-run"}
        </div>
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        {live ? "Delivering to real recipients." : <>Not configured — messages are logged, not sent. Set <span className="mono">{envHint}</span> in .env.</>}
      </div>
    </div>
  );
}

function statusOf(status: string) {
  if (status === "sent") return { s: "matched", label: "sent" };
  if (status === "failed") return { s: "unmatched", label: "failed" };
  if (status === "simulated") return { s: "amber", label: "dry-run" };
  return { s: "slate", label: status };
}

export default async function MessagesPage() {
  const landlord = await requireLandlord();
  const smsLive = onfonConfigured();
  const emailLive = resendConfigured();
  const waLive = whatsappConfigured();

  const messages = await prisma.messageLog.findMany({
    where: { landlordId: landlord.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle="Every message RentLink sends — SMS and email receipts, invoices and reminders — with delivery status."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        <ChannelStatus name="Onfon SMS" live={smsLive} envHint="ONFON_* keys" />
        <ChannelStatus name="WhatsApp" live={waLive} envHint="WHATSAPP_* keys" />
        <ChannelStatus name="Resend email" live={emailLive} envHint="RESEND_API_KEY + EMAIL_FROM" />
      </div>

      {messages.length === 0 ? (
        <div className="card">
          <EmptyState title="No messages yet" hint="Generate rent or reconcile a payment to send the first SMS." />
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {messages.map((m) => {
            const st = statusOf(m.status);
            return (
              <div key={m.id} className="card card-pad">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ChannelChip channel={m.channel} />
                    <Badge status="slate" label={KIND_LABEL[m.kind] || m.kind} />
                    <span style={{ fontWeight: 600 }}>{m.toName || m.toEmail || m.toPhone}</span>
                    <span className="faint mono" style={{ fontSize: 12 }}>{m.channel === "email" ? m.toEmail : m.toPhone}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="faint" style={{ fontSize: 12 }}>{dateTime(m.createdAt)}</span>
                    <Badge status={st.s} label={st.label} />
                  </div>
                </div>
                {m.subject && (
                  <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600 }}>{m.subject}</div>
                )}
                <div style={{ marginTop: m.subject ? 4 : 10, fontSize: 14, color: "var(--ink-soft)", background: "var(--bg)", padding: "10px 12px", borderRadius: 8 }}>
                  {m.body}
                </div>
                {m.error && <div className="badge badge-red" style={{ marginTop: 8 }}>{m.error}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
