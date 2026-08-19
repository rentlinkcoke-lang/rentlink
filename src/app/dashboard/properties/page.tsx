import Link from "next/link";
import { requireLandlord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kes } from "@/lib/format";
import { PageHeader, EmptyState } from "../../ui";
import { createProperty } from "../actions";

export default async function PropertiesPage() {
  const landlord = await requireLandlord();
  const properties = await prisma.property.findMany({
    where: { landlordId: landlord.id },
    orderBy: { createdAt: "asc" },
    include: {
      units: { include: { leases: { where: { status: "active" }, select: { id: true } } } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle="Each property gets a code that prefixes every unit's M-Pesa reference."
        action={
          <details style={{ position: "relative" }}>
            <summary className="btn btn-primary" style={{ listStyle: "none" }}>+ Add property</summary>
            <div className="card card-pad" style={{ position: "absolute", right: 0, top: 44, width: 320, zIndex: 20 }}>
              <form action={createProperty} style={{ display: "grid", gap: 12 }}>
                <div>
                  <label className="label">Property name</label>
                  <input name="name" className="input" placeholder="Bloom Court" required />
                </div>
                <div>
                  <label className="label">Location <span className="faint">(optional)</span></label>
                  <input name="location" className="input" placeholder="Kilimani, Nairobi" />
                </div>
                <button className="btn btn-primary">Create property</button>
              </form>
            </div>
          </details>
        }
      />

      {properties.length === 0 ? (
        <div className="card"><EmptyState title="No properties yet" hint="Add your first property to get started." /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
          {properties.map((p) => {
            const units = p.units.length;
            const occupied = p.units.filter((u) => u.leases.length > 0).length;
            const monthly = p.units.reduce((s, u) => (u.leases.length ? s + u.rent : s), 0);
            return (
              <Link key={p.id} href={`/dashboard/properties/${p.id}`} className="card card-pad" style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div className="h2">{p.name}</div>
                  <span className="badge badge-slate mono">{p.code}</span>
                </div>
                <div className="faint" style={{ fontSize: 13, marginTop: 2 }}>{p.location || "—"}</div>
                <div style={{ display: "flex", gap: 20, marginTop: 16 }}>
                  <div>
                    <div className="stat-label">Units</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{occupied}/{units}</div>
                  </div>
                  <div>
                    <div className="stat-label">Monthly roll</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }} className="mono">{kes(monthly)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
