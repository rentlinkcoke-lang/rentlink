// SMS message templates. Kept within GSM-7 (no emoji / em-dash) and short so
// each message stays a single 160-char segment where possible. The richer
// WhatsApp receipt (with emoji) lives in reconcile.ts:buildReceipt.

import { periodLabel } from "./format";

function money(n: number): string {
  return "KES " + n.toLocaleString("en-KE");
}

export function smsReceipt(args: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  amount: number;
  balance: number;
  mpesaCode: string;
  business: string;
}): string {
  const first = args.tenantName.split(" ")[0];
  const bal = args.balance > 0 ? ` Balance ${money(args.balance)}.` : " You are fully paid. Asante!";
  return `Hi ${first}, we received ${money(args.amount)} for ${args.propertyName} ${args.unitLabel}.${bal} Ref ${args.mpesaCode}. -${args.business}`;
}

export function smsInvoice(args: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  amount: number;
  year: number;
  month: number;
  paybill: string;
  payRef: string;
  business: string;
}): string {
  const first = args.tenantName.split(" ")[0];
  return `Hi ${first}, your ${periodLabel(args.year, args.month)} rent for ${args.propertyName} ${args.unitLabel} is ${money(args.amount)}. Pay via M-Pesa Paybill ${args.paybill}, Acct ${args.payRef}. -${args.business}`;
}

export function smsReminder(args: {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  balance: number;
  paybill: string;
  payRef: string;
  business: string;
}): string {
  const first = args.tenantName.split(" ")[0];
  return `Hi ${first}, a reminder that ${args.propertyName} ${args.unitLabel} has an outstanding balance of ${money(args.balance)}. Pay via M-Pesa Paybill ${args.paybill}, Acct ${args.payRef}. -${args.business}`;
}
