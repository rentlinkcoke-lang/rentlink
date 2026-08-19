// HTML email templates. Email clients need inline styles and table layout, so
// these are deliberately plain. Each returns { subject, html, text }.

import { periodLabel } from "./format";

function money(n: number): string {
  return "KES " + n.toLocaleString("en-KE");
}

interface Built {
  subject: string;
  html: string;
  text: string;
}

function shell(args: { heading: string; accent: string; rows: string; footNote: string; business: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f7f3;font-family:Arial,Helvetica,sans-serif;color:#16211b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f3;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #e3e8e0;border-radius:14px;overflow:hidden;">
        <tr><td style="background:${args.accent};padding:18px 24px;color:#ffffff;font-size:18px;font-weight:bold;">⌂ ${args.business}</td></tr>
        <tr><td style="padding:24px;">
          <div style="font-size:20px;font-weight:bold;letter-spacing:-0.02em;margin-bottom:16px;">${args.heading}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.6;">
            ${args.rows}
          </table>
          <div style="margin-top:18px;font-size:13px;color:#566158;">${args.footNote}</div>
        </td></tr>
        <tr><td style="padding:14px 24px;border-top:1px solid #e3e8e0;font-size:12px;color:#899588;">
          Sent by ${args.business} via RentLink · property management for Kenya
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function row(label: string, value: string, strong = false): string {
  return `<tr>
    <td style="padding:6px 0;color:#566158;">${label}</td>
    <td style="padding:6px 0;text-align:right;font-weight:${strong ? "bold" : "normal"};">${value}</td>
  </tr>`;
}

export function emailReceipt(args: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  amount: number;
  balance: number;
  mpesaCode: string;
  allocated: { period: string; type: string; amount: number }[];
  business: string;
}): Built {
  const first = args.tenantName.split(" ")[0];
  const allocRows = args.allocated
    .map((a) => row(`${a.period} ${a.type}`, money(a.amount)))
    .join("");
  const balRow =
    args.balance > 0
      ? row("Outstanding balance", money(args.balance), true)
      : row("Balance", "Fully paid — asante!", true);

  const rows =
    row("Property / Unit", `${args.propertyName} ${args.unitLabel}`) +
    row("Amount received", money(args.amount), true) +
    allocRows +
    balRow +
    row("M-Pesa ref", args.mpesaCode);

  const text = `Hi ${first}, we've received ${money(args.amount)} for ${args.propertyName} ${args.unitLabel}. ${
    args.balance > 0 ? "Balance " + money(args.balance) + "." : "You are fully paid. Asante!"
  } Ref ${args.mpesaCode}. -${args.business}`;

  return {
    subject: `Payment received — ${money(args.amount)} for ${args.unitLabel}`,
    html: shell({
      heading: `Hi ${first}, payment received ✅`,
      accent: "#2e9e4f",
      rows,
      footNote: "Keep this email as your receipt. Questions? Just reply.",
      business: args.business,
    }),
    text,
  };
}

export function emailInvoice(args: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  amount: number;
  year: number;
  month: number;
  paybill: string;
  payRef: string;
  business: string;
}): Built {
  const first = args.tenantName.split(" ")[0];
  const rows =
    row("Property / Unit", `${args.propertyName} ${args.unitLabel}`) +
    row("Period", periodLabel(args.year, args.month)) +
    row("Amount due", money(args.amount), true) +
    row("Pay to Paybill", args.paybill, true) +
    row("Account number", args.payRef, true);

  const text = `Hi ${first}, your ${periodLabel(args.year, args.month)} rent for ${args.propertyName} ${args.unitLabel} is ${money(
    args.amount
  )}. Pay via M-Pesa Paybill ${args.paybill}, Account ${args.payRef}. -${args.business}`;

  return {
    subject: `${periodLabel(args.year, args.month)} rent invoice — ${args.unitLabel}`,
    html: shell({
      heading: `Hi ${first}, your ${periodLabel(args.year, args.month)} rent invoice`,
      accent: "#1f7d3c",
      rows,
      footNote: `Pay via M-Pesa: Paybill <b>${args.paybill}</b>, Account <b>${args.payRef}</b>. Your receipt is sent automatically once paid.`,
      business: args.business,
    }),
    text,
  };
}

export function emailReminder(args: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  balance: number;
  paybill: string;
  payRef: string;
  business: string;
}): Built {
  const first = args.tenantName.split(" ")[0];
  const rows =
    row("Property / Unit", `${args.propertyName} ${args.unitLabel}`) +
    row("Outstanding balance", money(args.balance), true) +
    row("Pay to Paybill", args.paybill, true) +
    row("Account number", args.payRef, true);

  const text = `Hi ${first}, a reminder that ${args.propertyName} ${args.unitLabel} has an outstanding balance of ${money(
    args.balance
  )}. Pay via M-Pesa Paybill ${args.paybill}, Account ${args.payRef}. -${args.business}`;

  return {
    subject: `Rent reminder — ${money(args.balance)} outstanding on ${args.unitLabel}`,
    html: shell({
      heading: `Hi ${first}, a gentle rent reminder`,
      accent: "#b7791a",
      rows,
      footNote: `Please clear your balance via M-Pesa: Paybill <b>${args.paybill}</b>, Account <b>${args.payRef}</b>.`,
      business: args.business,
    }),
    text,
  };
}
