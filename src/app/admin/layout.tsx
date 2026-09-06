import { requireSuperAdmin } from "@/lib/admin";
import AdminSidebar from "./AdminSidebar";

// Private admin console — never index.
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireSuperAdmin();
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <AdminSidebar name={me.name} email={me.email} />
      <main className="rl-admin-main">{children}</main>
    </div>
  );
}
