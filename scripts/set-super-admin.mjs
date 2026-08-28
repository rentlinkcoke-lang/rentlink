// Promote an existing landlord account to platform super-admin (idempotent).
// The account must already exist — register it first at /register so the
// password is set by the account owner (never handled here or in chat).
//
// Run: node --env-file=.env scripts/set-super-admin.mjs <email>
//   defaults to rentlink.co.ke@gmail.com if no email is given.
// To demote:  node --env-file=.env scripts/set-super-admin.mjs <email> --off

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const email = (process.argv[2] || "rentlink.co.ke@gmail.com").trim().toLowerCase();
const on = !process.argv.includes("--off");

const existing = await prisma.landlord.findUnique({ where: { email } });
if (!existing) {
  console.error(`✗ No account found for ${email}.`);
  console.error(`  Register it first at /register, then re-run this script.`);
  await prisma.$disconnect();
  process.exit(1);
}

const updated = await prisma.landlord.update({
  where: { email },
  data: { isSuperAdmin: on, suspended: false },
  select: { email: true, name: true, isSuperAdmin: true },
});

console.log(`✓ ${updated.email} (${updated.name}) — isSuperAdmin = ${updated.isSuperAdmin}`);
console.log(on ? `  They now land on /admin at login.` : `  Super-admin access removed.`);
await prisma.$disconnect();
