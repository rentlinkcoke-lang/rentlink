import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your RentLink dashboard to manage properties, tenants and M-Pesa rent collection.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
