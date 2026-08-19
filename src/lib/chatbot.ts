// WhatsApp pay-in-chat bot. A tenant messages the business number; we identify
// them by phone, answer balance queries, and fire an STK Push on "PAY" — the
// whole rent payment happens inside the chat.

import { prisma } from "./prisma";
import { kes } from "./format";
import { sendWhatsAppText } from "./notify";
import { initiateStkForLease } from "./collections";

export function normalizePhone(raw: string): string {
  let p = raw.replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  return p;
}

export interface BotOutcome {
  matched: boolean;
  reply: string;
  action?: "balance" | "pay" | "help" | "unknown-number";
}

export async function handleInboundWhatsApp(input: {
  fromPhone: string;
  text: string;
  profileName?: string;
}): Promise<BotOutcome> {
  const phone = normalizePhone(input.fromPhone);

  const lease = await prisma.lease.findFirst({
    where: { status: "active", tenant: { phone } },
    orderBy: { startDate: "desc" },
    include: {
      tenant: true,
      unit: { include: { property: true } },
      invoices: { where: { status: { in: ["pending", "partial", "overdue"] } }, select: { amount: true, amountPaid: true } },
    },
  });

  // Unknown number — can't act, but still reply politely. No landlord to log under.
  if (!lease) {
    return {
      matched: false,
      action: "unknown-number",
      reply:
        "Hi! We couldn't find a tenancy linked to this number. Please check with your landlord that your correct M-Pesa number is on file.",
    };
  }

  const landlordId = lease.unit.property.landlordId;
  const landlord = await prisma.landlord.findUnique({ where: { id: landlordId } });
  const business = landlord?.businessName || landlord?.name || "RentLink";
  const unit = `${lease.unit.property.name} ${lease.unit.label}`;
  const first = lease.tenant.name.split(" ")[0];
  const balance = lease.invoices.reduce((s, i) => s + (i.amount - i.amountPaid), 0);

  const cmd = input.text.trim().toUpperCase();
  let reply: string;
  let action: BotOutcome["action"];

  if (cmd.startsWith("PAY") || cmd === "1") {
    if (balance <= 0) {
      action = "balance";
      reply = `You're fully paid up for ${unit} 🎉. Nothing to pay right now. Asante, ${first}!`;
    } else {
      const res = await initiateStkForLease(landlordId, lease.id);
      action = "pay";
      reply = res.ok
        ? `📲 Sending an M-Pesa prompt for ${kes(res.amount!)} to your phone now — enter your M-Pesa PIN to pay rent for ${unit}. You'll get a receipt here once it's done.`
        : `Sorry ${first}, we couldn't start the payment: ${res.error} Please try again shortly.`;
    }
  } else if (cmd.startsWith("BAL") || cmd === "B" || cmd === "2") {
    action = "balance";
    reply =
      balance > 0
        ? `Hi ${first}, your balance for ${unit} is ${kes(balance)}.\n\nReply *PAY* to pay now via M-Pesa.`
        : `Hi ${first}, you're fully paid for ${unit}. Asante! 🎉`;
  } else {
    action = "help";
    reply = `Hi ${first}! 👋 I'm the ${business} rent assistant for ${unit}.\n\nReply:\n• *BALANCE* — see what you owe\n• *PAY* — pay your rent via M-Pesa\n\nYour balance right now is ${kes(balance)}.`;
  }

  await sendWhatsAppText({ landlordId, toPhone: phone, toName: lease.tenant.name, body: reply, tenantId: lease.tenantId });
  return { matched: true, reply, action };
}
