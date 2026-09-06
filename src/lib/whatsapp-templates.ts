// WhatsApp template payloads. Each returns the template name, the ordered body
// parameters Meta will substitute into {{1}},{{2}},…, and a `preview` string that
// renders those params into the approved body text (stored in the outbox so the
// landlord sees exactly what the tenant received).
//
// The approved template bodies these mirror are documented in WHATSAPP_SETUP.md.

import { periodLabel } from "./format";

function money(n: number): string {
  return "KES " + n.toLocaleString("en-KE");
}

export interface WaTemplate {
  templateName: string;
  params: string[];
  preview: string;
}

// {{1}} name  {{2}} amount  {{3}} property+unit  {{4}} period  {{5}} balance line  {{6}} business
// NB: the M-Pesa code is intentionally NOT in the WhatsApp receipt — Meta's
// template classifier reads a 10-char code as an OTP and rejects it as
// "Authentication". SMS/email receipts still carry the code.
export function waReceipt(args: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  amount: number;
  period: string;
  balance: number;
  mpesaCode: string;
  business: string;
}): WaTemplate {
  const first = args.tenantName.split(" ")[0];
  const unit = `${args.propertyName} ${args.unitLabel}`;
  const balLine = args.balance > 0 ? `Balance remaining: ${money(args.balance)}` : "You are fully paid. Asante!";
  const params = [first, money(args.amount), unit, args.period, balLine, args.business];
  return {
    templateName: process.env.WHATSAPP_TEMPLATE_RECEIPT || "rent_receipt",
    params,
    preview: `Hi ${first}, we have received your rent payment of ${money(args.amount)} for ${unit}, ${args.period}.\n${balLine}\nThis receipt was sent by ${args.business} through RentLink.`,
  };
}

// {{1}} name  {{2}} period  {{3}} property+unit  {{4}} amount  {{5}} paybill  {{6}} payRef  {{7}} business
export function waInvoice(args: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  amount: number;
  year: number;
  month: number;
  paybill: string;
  payRef: string;
  business: string;
}): WaTemplate {
  const first = args.tenantName.split(" ")[0];
  const unit = `${args.propertyName} ${args.unitLabel}`;
  const period = periodLabel(args.year, args.month);
  const params = [first, period, unit, money(args.amount), args.paybill, args.payRef, args.business];
  return {
    templateName: process.env.WHATSAPP_TEMPLATE_INVOICE || "rent_invoice",
    params,
    preview: `Hi ${first}, this is your rent invoice for ${period}. Your rent for ${unit} is ${money(args.amount)}.\nTo pay, use M-Pesa Paybill ${args.paybill} and Account number ${args.payRef}.\nThis invoice was sent by ${args.business} through RentLink.`,
  };
}

// {{1}} name  {{2}} property+unit  {{3}} balance  {{4}} paybill  {{5}} payRef  {{6}} business
export function waReminder(args: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  balance: number;
  paybill: string;
  payRef: string;
  business: string;
}): WaTemplate {
  const first = args.tenantName.split(" ")[0];
  const unit = `${args.propertyName} ${args.unitLabel}`;
  const params = [first, unit, money(args.balance), args.paybill, args.payRef, args.business];
  return {
    templateName: process.env.WHATSAPP_TEMPLATE_REMINDER || "rent_reminder",
    params,
    preview: `Hi ${first}, this is a friendly reminder that ${unit} has an outstanding rent balance of ${money(args.balance)}.\nTo pay, use M-Pesa Paybill ${args.paybill} and Account number ${args.payRef}.\nThis reminder was sent by ${args.business} through RentLink.`,
  };
}
