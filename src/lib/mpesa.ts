// Safaricom Daraja C2B compatibility layer.
//
// When a tenant pays a Paybill, Safaricom POSTs a "Confirmation" callback to a
// URL you register. This normalizes that payload into our IncomingPayment shape
// so the same reconciliation engine serves both the real Daraja webhook and the
// in-app simulator.
//
// Reference payload (C2B Confirmation):
// {
//   "TransactionType": "Pay Bill",
//   "TransID": "SGH7X8Y9Z0",
//   "TransTime": "20260816120000",
//   "TransAmount": "25000.00",
//   "BusinessShortCode": "4109210",
//   "BillRefNumber": "BLOOMB4",
//   "MSISDN": "254712345678",
//   "FirstName": "WANJIKU",
//   "LastName": "KAMAU"
// }

import type { IncomingPayment } from "./reconcile";

export interface DarajaC2BConfirmation {
  TransID?: string;
  TransAmount?: string | number;
  BillRefNumber?: string;
  MSISDN?: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
  BusinessShortCode?: string | number;
}

export function parseC2B(body: DarajaC2BConfirmation, landlordId: string): IncomingPayment | null {
  const code = (body.TransID || "").toString().trim();
  const amount = Math.round(Number(body.TransAmount) || 0);
  const ref = (body.BillRefNumber || "").toString().trim();
  if (!code || amount <= 0) return null;

  const name = [body.FirstName, body.MiddleName, body.LastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    landlordId,
    mpesaCode: code,
    amount,
    payRef: ref,
    payerPhone: (body.MSISDN || "").toString().trim(),
    payerName: name || undefined,
    raw: JSON.stringify(body),
  };
}

// The response Safaricom expects from a confirmation callback.
export const DARAJA_ACK = { ResultCode: 0, ResultDesc: "Accepted" };
