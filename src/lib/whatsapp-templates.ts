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

// {{1}} name  {{2}} amount  {{3}} property+unit  {{4}} balance line  {{5}} ref  {{6}} business
export function waReceipt(args: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  amount: number;
  balance: number;
  mpesaCode: string;
  business: string;
}): WaTemplate {
  const first = args.tenantName.split(" ")[0];
  const unit = `${args.propertyName} ${args.unitLabel}`;
  const balLine = args.balance > 0 ? `Balance remaining: ${money(args.balance)}` : "You are fully paid. Asante!";
  const params = [first, money(args.amount), unit, balLine, args.mpesaCode, args.business];
  return {
    templateName: process.env.WHATSAPP_TEMPLATE_RECEIPT || "rent_receipt",
    params,
    preview: `✅ Payment received\n\nHi ${first}, we've received ${money(args.amount)} for ${unit}.\n${balLine}\n\nRef: ${args.mpesaCode}\n— ${args.business}`,
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
    preview: `🧾 ${period} rent invoice\n\nHi ${first}, your rent for ${unit} is ${money(args.amount)}.\n\nPay via M-Pesa Paybill ${args.paybill}, Account ${args.payRef}.\n— ${args.business}`,
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
    preview: `🔔 Rent reminder\n\nHi ${first}, ${unit} has an outstanding balance of ${money(args.balance)}.\n\nPay via M-Pesa Paybill ${args.paybill}, Account ${args.payRef}.\n— ${args.business}`,
  };
}
