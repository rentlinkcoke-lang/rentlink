import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Start free",
  description:
    "Create a RentLink account free. Give every unit its own M-Pesa reference and let rent reconcile itself. KES 75 per unit / month, no setup fee.",
  alternates: { canonical: "/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
