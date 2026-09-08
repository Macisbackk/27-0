import type { MetadataRoute } from "next";

const SITE_URL = "https://www.27-0.co.uk";

/** Required for `output: "export"` (Capacitor mobile builds). */
export const dynamic = "force-static";

/** Public routes for crawlers and link inspectors. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes = [
    "",
    "/play",
    "/leaderboard",
    "/showcase",
    "/store",
    "/profile",
    "/stats",
    "/login",
    "/quiz",
    "/mini-games",
    "/mini-games/quiz",
    "/mini-games/wordle",
    "/mini-games/hangman",
    "/mini-games/higher-lower",
  ];

  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
