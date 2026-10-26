import type { MetadataRoute } from "next";

const SITE_URL = "https://www.27-0.co.uk";

/** Required for `output: "export"` (Capacitor mobile builds). */
export const dynamic = "force-static";

/** Public routes for crawlers and link inspectors. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes = [
    "",
    "/manager",
    "/play",
    "/modes",
    "/leaderboard",
    "/showcase",
    "/store",
    "/mini-games",
    "/mini-games/quiz",
    "/mini-games/wordle",
    "/mini-games/grid",
    "/privacy",
    "/delete-account",
  ];

  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
