import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RentLink — rent that reconciles itself",
    short_name: "RentLink",
    description:
      "Property management for Kenya. Every unit gets its own M-Pesa reference, so rent reconciles itself.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0f3d24",
    theme_color: "#0f3d24",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["business", "finance", "productivity"],
    orientation: "portrait",
  };
}
