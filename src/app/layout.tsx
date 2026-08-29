import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "./PwaRegister";

const SITE = "https://rentlink.co.ke";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "RentLink — rent that reconciles itself",
    template: "%s · RentLink",
  },
  description:
    "Property management software for Kenya. Give every unit its own M-Pesa reference, so rent reconciles itself and WhatsApp receipts send automatically. KES 75 per unit / month, no setup fee.",
  applicationName: "RentLink",
  keywords: [
    "property management software Kenya",
    "M-Pesa rent collection",
    "rent management app Kenya",
    "paybill rent reconciliation",
    "landlord software Kenya",
    "rental management system",
    "M-Pesa paybill rent",
    "tenant management Kenya",
  ],
  authors: [{ name: "RentLink" }],
  creator: "RentLink",
  publisher: "RentLink",
  alternates: { canonical: "/" },
  category: "business",
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: SITE,
    siteName: "RentLink",
    title: "RentLink — rent that reconciles itself",
    description:
      "Every unit gets its own M-Pesa reference. The tenant pays, and RentLink instantly knows who paid, for which unit, for which month — then WhatsApps the receipt.",
  },
  twitter: {
    card: "summary_large_image",
    title: "RentLink — rent that reconciles itself",
    description:
      "M-Pesa rent that reconciles itself. Property management built for the Kenyan market.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "RentLink",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f3d24",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-KE">
      <body>{children}<PwaRegister /></body>
    </html>
  );
}
