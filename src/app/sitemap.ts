import type { MetadataRoute } from "next";

const SITE_URL = "https://www.27-0.co.uk";

/** Public routes for crawlers and link inspectors. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes = [
    "",
    "/play",
    "/manager",
    "/leaderboard",
    "/showcase",
    "/store",
    "/profile",
    "/stats",
    "/login",
  ];

  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
