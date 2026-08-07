import type { MetadataRoute } from "next";

const SITE_URL = "https://www.27-0.co.uk";

/** Public crawl rules — allow all bots; no Disallow: /. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
