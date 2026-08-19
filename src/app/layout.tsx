import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentLink — rent that reconciles itself",
  description:
    "Property management for the Kenyan market. Every unit gets its own M-Pesa reference, so rent reconciles itself and receipts send automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
