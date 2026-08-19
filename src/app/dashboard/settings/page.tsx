import { requireLandlord } from "@/lib/auth";
import { onfonConfigured } from "@/lib/sms";
import { resendConfigured } from "@/lib/email";
import { whatsappConfigured } from "@/lib/whatsapp";
import { resolveCreds } from "@/lib/daraja";
import { PageHeader } from "../../ui";
import { updateSettings, updateMpesaCredentials, registerCallbacks } from "../actions";

export default async function SettingsPage() {
  const landlord = await requireLandlord();
  const smsLive = onfonConfigured();
  const emailLive = resendConfigured();
  const waLive = whatsappConfigured();
  const mpesaConnected = resolveCreds(landlord) != null;
  const confirmationUrl = `${process.env.APP_BASE_URL || "http://localhost:3000"}/api/mpesa/c2b/confirmation?landlord=${landlord.id}`;
  return (
    <div>
      <PageHeader title="Settings" subtitle="Your business details and M-Pesa collection account." />
      <div className="card card-pad" style={{ maxWidth: 520 }}>
        <form action={updateSettings} style={{ display: "grid", gap: 16 }}>
          <div>
            <label className="label">Business name</label>
            <input name="businessName" className="input" defaultValue={landlord.businessName || ""} placeholder="Mwangi Properties" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input mono" defaultValue={landlord.phone || ""} placeholder="0722 000 000" />
          </div>
          <div>
            <label className="label">M-Pesa Paybill</label>
            <input name="paybill" className="input mono" defaultValue={landlord.paybill || ""} placeholder="4109210" />
            <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
              The business shortcode tenants pay into. Each unit's reference is the account number under this Paybill.
            </div>
          </div>
          <div>
            <label className="label">SMS Sender ID <span className="faint">(Onfon)</span></label>
            <input name="smsSenderId" className="input mono" defaultValue={landlord.smsSenderId || ""} placeholder="MWANGI" />
            <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
              The name recipients see as the SMS sender. Must be an approved Sender ID on your Onfon account.
            </div>
          </div>
          <div>
            <label className="label">Notify tenants on</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 2 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, cursor: "pointer" }}>
                <input type="checkbox" name="smsOn" defaultChecked={landlord.smsOn} /> SMS <span className="faint">(Onfon)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, cursor: "pointer" }}>
                <input type="checkbox" name="whatsappOn" defaultChecked={landlord.whatsappOn} /> WhatsApp <span className="faint">(needs an approved WABA)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14, cursor: "pointer" }}>
                <input type="checkbox" name="emailOn" defaultChecked={landlord.emailOn} /> Email <span className="faint">(tenants with an address on file)</span>
              </label>
            </div>
            <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
              Receipts, invoices and reminders go out on every channel you enable here.
            </div>
          </div>
          <div>
            <label className="label">Account email</label>
            <input className="input" value={landlord.email} readOnly style={{ background: "var(--bg)" }} />
          </div>
          <button className="btn btn-primary" style={{ width: "fit-content" }}>Save changes</button>
        </form>
      </div>

      <div className="card card-pad" style={{ maxWidth: 520, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="dot" style={{ width: 10, height: 10, background: mpesaConnected ? "var(--brand)" : "var(--amber)" }} />
          <div className="h2">M-Pesa collection — your Paybill</div>
        </div>
        <div className="muted" style={{ fontSize: 14, marginTop: 6, marginBottom: 14 }}>
          Rent is paid <b>directly into your own Paybill</b> — RentLink never holds your money. Connect your Daraja
          app so we can push STK prompts and read payments. Requires a <b>Paybill</b> (a Till can't carry the
          per-unit account number). {mpesaConnected ? <span style={{ color: "var(--brand-dark)", fontWeight: 600 }}>Connected in {landlord.darajaEnv} mode.</span> : <span style={{ color: "var(--amber)", fontWeight: 600 }}>Not connected — STK requests run in simulation.</span>}
        </div>
        <form action={updateMpesaCredentials} style={{ display: "grid", gap: 14 }}>
          <div style={{ padding: "8px 10px", background: "var(--bg)", borderRadius: 8, fontSize: 13 }} className="muted">
            Paybill (shortcode): <b className="mono">{landlord.paybill || "— set it in Business details above"}</b>
          </div>
          <div>
            <label className="label">Environment</label>
            <select name="darajaEnv" className="select" defaultValue={landlord.darajaEnv}>
              <option value="sandbox">Sandbox (testing)</option>
              <option value="production">Production (live money)</option>
            </select>
          </div>
          <div>
            <label className="label">Consumer Key</label>
            <input name="consumerKey" className="input mono" defaultValue={landlord.darajaConsumerKey || ""} placeholder="from your Daraja app" />
          </div>
          <div>
            <label className="label">Consumer Secret</label>
            <input name="consumerSecret" type="password" className="input" placeholder={landlord.darajaConsumerSecret ? "•••••••• saved — re-enter to change" : "from your Daraja app"} />
          </div>
          <div>
            <label className="label">Lipa na M-Pesa Passkey</label>
            <input name="passkey" type="password" className="input" placeholder={landlord.darajaPasskey ? "•••••••• saved — re-enter to change" : "for STK Push on your shortcode"} />
          </div>
          <button className="btn btn-primary" style={{ width: "fit-content" }}>Save connection</button>
        </form>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div className="label">C2B confirmation URL</div>
          <div className="faint" style={{ fontSize: 13, marginBottom: 8 }}>Register this on your shortcode so walk-in M-Pesa payments reconcile too.</div>
          <pre className="mono" style={{ background: "var(--bg)", padding: 10, borderRadius: 8, fontSize: 12, overflowX: "auto" }}>{confirmationUrl}</pre>
          {mpesaConnected && (
            <form action={registerCallbacks} style={{ marginTop: 10 }}>
              <button className="btn btn-ghost" style={{ fontSize: 13 }}>Register URLs on my shortcode automatically</button>
            </form>
          )}
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 520, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="dot" style={{ width: 10, height: 10, background: smsLive ? "var(--brand)" : "var(--amber)" }} />
          <div className="h2">SMS — Onfon Media</div>
        </div>
        <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
          {smsLive ? (
            <>Connected. Receipts, invoices and reminders send over your Onfon account.</>
          ) : (
            <>
              Running in <b>dry-run</b> mode. Add your Onfon credentials to <span className="mono">.env</span> to start
              sending real SMS:
              <pre className="mono" style={{ marginTop: 10, background: "var(--bg)", padding: 12, borderRadius: 8, fontSize: 12, overflowX: "auto" }}>
{`ONFON_API_KEY="…"
ONFON_CLIENT_ID="…"
ONFON_ACCESS_KEY="…"
ONFON_SENDER_ID="…"`}
              </pre>
              <span className="faint" style={{ fontSize: 12 }}>Find these in the Onfon dashboard under Settings → API SETTINGS.</span>
            </>
          )}
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 520, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="dot" style={{ width: 10, height: 10, background: waLive ? "var(--brand)" : "var(--amber)" }} />
          <div className="h2">WhatsApp — Meta Cloud API</div>
        </div>
        <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
          {waLive ? (
            <>Connected. Enable WhatsApp above to send template messages to tenants.</>
          ) : (
            <>
              Running in <b>dry-run</b> mode. Add your WhatsApp Cloud API credentials to <span className="mono">.env</span>,
              then create &amp; get the templates approved (see <span className="mono">WHATSAPP_SETUP.md</span>):
              <pre className="mono" style={{ marginTop: 10, background: "var(--bg)", padding: 12, borderRadius: 8, fontSize: 12, overflowX: "auto" }}>
{`WHATSAPP_ACCESS_TOKEN="…"
WHATSAPP_PHONE_NUMBER_ID="…"`}
              </pre>
              <span className="faint" style={{ fontSize: 12 }}>Business-initiated messages require approved templates — this is the long-lead item.</span>
            </>
          )}
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div className="label">Pay-in-chat inbound webhook</div>
          <div className="faint" style={{ fontSize: 13, marginBottom: 8 }}>Register this in Meta → WhatsApp → Configuration so tenants can pay by messaging you.</div>
          <pre className="mono" style={{ background: "var(--bg)", padding: 10, borderRadius: 8, fontSize: 12, overflowX: "auto" }}>{`${process.env.APP_BASE_URL || "http://localhost:3000"}/api/whatsapp/webhook
verify token: ${process.env.WHATSAPP_VERIFY_TOKEN || "keja-verify"}`}</pre>
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 520, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="dot" style={{ width: 10, height: 10, background: emailLive ? "var(--brand)" : "var(--amber)" }} />
          <div className="h2">Email — Resend</div>
        </div>
        <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
          {emailLive ? (
            <>Connected. Tenants with an email on file also get emailed receipts, invoices and reminders.</>
          ) : (
            <>
              Running in <b>dry-run</b> mode. Add your Resend key to <span className="mono">.env</span> and verify your
              sending domain:
              <pre className="mono" style={{ marginTop: 10, background: "var(--bg)", padding: 12, borderRadius: 8, fontSize: 12, overflowX: "auto" }}>
{`RESEND_API_KEY="re_…"
EMAIL_FROM="RentLink <receipts@yourdomain>"`}
              </pre>
            </>
          )}
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 520, marginTop: 16 }}>
        <div className="h2">Webhook</div>
        <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
          Point your Safaricom Daraja C2B <b>Confirmation URL</b> here to go live:
        </div>
        <pre className="mono" style={{ marginTop: 10, background: "var(--bg)", padding: 12, borderRadius: 8, fontSize: 13, overflowX: "auto" }}>
          POST /api/mpesa/c2b/confirmation?landlord={landlord.id}
        </pre>
      </div>
    </div>
  );
}
