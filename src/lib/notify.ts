// Channel dispatcher + delivery log. Today it drives SMS via Onfon; email and
// WhatsApp will plug in here behind the same interface.
//
// Safe by default: if Onfon isn't configured, messages are recorded in the
// outbox with status "simulated" and NOT sent — so the demo never spends credit.

import { prisma } from "./prisma";
import { onfonConfigured, onfonSend } from "./sms";
import { resendConfigured, resendSend } from "./email";
import { whatsappConfigured, whatsappSendTemplate, whatsappSendText } from "./whatsapp";

export interface SendSmsArgs {
  landlordId: string;
  toPhone: string;
  toName?: string;
  body: string;
  kind: "invoice" | "receipt" | "reminder" | "manual";
  senderId?: string;
  tenantId?: string;
  invoiceId?: string;
  paymentId?: string;
}

export async function sendSms(args: SendSmsArgs) {
  // Dry-run when unconfigured — log it, don't send.
  if (!onfonConfigured()) {
    return prisma.messageLog.create({
      data: {
        landlordId: args.landlordId,
        channel: "sms",
        kind: args.kind,
        toPhone: args.toPhone,
        toName: args.toName,
        body: args.body,
        status: "simulated",
        tenantId: args.tenantId,
        invoiceId: args.invoiceId,
        paymentId: args.paymentId,
      },
    });
  }

  const res = await onfonSend({ to: args.toPhone, text: args.body, senderId: args.senderId });
  return prisma.messageLog.create({
    data: {
      landlordId: args.landlordId,
      channel: "sms",
      kind: args.kind,
      toPhone: args.toPhone,
      toName: args.toName,
      body: args.body,
      status: res.ok ? "sent" : "failed",
      providerId: res.messageId,
      error: res.error,
      tenantId: args.tenantId,
      invoiceId: args.invoiceId,
      paymentId: args.paymentId,
    },
  });
}

export interface SendEmailArgs {
  landlordId: string;
  toEmail: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  kind: "invoice" | "receipt" | "reminder" | "manual";
  tenantId?: string;
  invoiceId?: string;
  paymentId?: string;
}

export async function sendEmail(args: SendEmailArgs) {
  const base = {
    landlordId: args.landlordId,
    channel: "email",
    kind: args.kind,
    toEmail: args.toEmail,
    toName: args.toName,
    subject: args.subject,
    body: args.text, // store the plain-text version in the log
    tenantId: args.tenantId,
    invoiceId: args.invoiceId,
    paymentId: args.paymentId,
  };

  // Dry-run when unconfigured.
  if (!resendConfigured()) {
    return prisma.messageLog.create({ data: { ...base, status: "simulated" } });
  }

  const res = await resendSend({ to: args.toEmail, subject: args.subject, html: args.html, text: args.text });
  return prisma.messageLog.create({
    data: { ...base, status: res.ok ? "sent" : "failed", providerId: res.id, error: res.error },
  });
}

export interface SendWhatsAppArgs {
  landlordId: string;
  toPhone: string;
  toName?: string;
  templateName: string;
  params: string[];
  preview: string; // human-readable rendering stored in the outbox
  kind: "invoice" | "receipt" | "reminder" | "manual";
  tenantId?: string;
  invoiceId?: string;
  paymentId?: string;
}

export async function sendWhatsApp(args: SendWhatsAppArgs) {
  const base = {
    landlordId: args.landlordId,
    channel: "whatsapp",
    kind: args.kind,
    toPhone: args.toPhone,
    toName: args.toName,
    body: args.preview,
    tenantId: args.tenantId,
    invoiceId: args.invoiceId,
    paymentId: args.paymentId,
  };

  // Dry-run when unconfigured.
  if (!whatsappConfigured()) {
    return prisma.messageLog.create({ data: { ...base, status: "simulated" } });
  }

  const res = await whatsappSendTemplate({
    to: args.toPhone,
    templateName: args.templateName,
    bodyParams: args.params,
  });
  return prisma.messageLog.create({
    data: { ...base, status: res.ok ? "sent" : "failed", providerId: res.id, error: res.error },
  });
}

// Free-form WhatsApp reply (bot replies inside the 24h window).
export async function sendWhatsAppText(args: {
  landlordId: string;
  toPhone: string;
  toName?: string;
  body: string;
  tenantId?: string;
}) {
  const base = {
    landlordId: args.landlordId,
    channel: "whatsapp",
    kind: "chat",
    toPhone: args.toPhone,
    toName: args.toName,
    body: args.body,
    tenantId: args.tenantId,
  };
  if (!whatsappConfigured()) {
    return prisma.messageLog.create({ data: { ...base, status: "simulated" } });
  }
  const res = await whatsappSendText({ to: args.toPhone, body: args.body });
  return prisma.messageLog.create({
    data: { ...base, status: res.ok ? "sent" : "failed", providerId: res.id, error: res.error },
  });
}
