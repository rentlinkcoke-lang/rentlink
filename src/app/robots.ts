import type { MetadataRoute } from "next";

const SITE = "https://rentlink.co.ke";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep the private app and API out of the index.
      disallow: ["/dashboard", "/admin", "/api", "/invite"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
