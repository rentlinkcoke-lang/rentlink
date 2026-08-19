import Link from "next/link";
import { requireLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "../../ui";
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
        subtitle="Load a whole building at once — units, and tenants where you have them."
      />
      {properties.length === 0 ? (
        <div className="card">
          <EmptyState title="Add a property first" hint="Imports load units into an existing property." />
          <div style={{ textAlign: "center", paddingBottom: 30 }}>
            <Link href="/dashboard/properties" className="btn btn-primary">Add a property →</Link>
          </div>
        </div>
      ) : (
        <ImportForm properties={properties} />
      )}
    </div>
  );
}
