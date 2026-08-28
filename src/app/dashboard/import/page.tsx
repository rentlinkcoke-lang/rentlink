import Link from "next/link";
import { requireLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "../../ui";
import ImportForm from "./ImportForm";

export default async function ImportPage() {
  const landlord = await requireLandlord();
  const properties = await prisma.property.findMany({
    where: { landlordId: landlord.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  return (
    <div>
      <PageHeader
        title="Bulk import"
        subtitle="Load your whole portfolio at once — properties, units, and tenants — from an Excel file."
      />
      <ImportForm properties={properties} />
      <p className="faint" style={{ fontSize: 13, marginTop: 16, maxWidth: 720 }}>
        Import is for standing up your portfolio. It adds new properties, units and tenants and
        skips anything that already exists — it never overwrites. To move a tenant out or in later,
        use the unit&rsquo;s <Link href="/dashboard/properties" style={{ color: "var(--brand-dark)", fontWeight: 600 }}>property page</Link>.
      </p>
    </div>
  );
}
