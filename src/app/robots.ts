import type { MetadataRoute } from "next";

const SITE_URL = "https://www.27-0.co.uk";

/** Public crawl rules — allow all bots (incl. ChatGPT / OpenAI fetchers). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
      // Explicit allows so OpenAI search / browse tools do not treat us as opted out.
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
      },
      {
        userAgent: "GPTBot",
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
