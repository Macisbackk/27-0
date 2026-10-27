import type { NextConfig } from "next";
import path from "path";

/** Set CAPACITOR_BUILD=1 for the packaged iPhone / Android (static) export. */
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // Lets the app build hide web-only bits (tip links, "install" prompts, web analytics) at build time.
  env: { NEXT_PUBLIC_APP_BUILD: isCapacitorBuild ? "1" : "" },
  images: {
    remotePatterns: [],
    // Static export cannot use the Next image optimizer.
    ...(isCapacitorBuild ? { unoptimized: true } : {}),
  },
  ...(isCapacitorBuild
    ? {
        output: "export" as const,
        // Helps file:// / Capacitor WebView resolve nested routes.
        trailingSlash: true,
      }
    : {
        // Retired / merged pages keep working for old links and bookmarks.
        async redirects() {
          return [
            // One address for the site: logins are saved per address, so 27-0.co.uk and
            // www.27-0.co.uk each kept their own sign-in (email links went to the bare domain).
            // .well-known stays on both so app links keep verifying.
            {
              source: "/:path((?!\\.well-known/).*)",
              has: [{ type: "host", value: "27-0.co.uk" }],
              destination: "https://www.27-0.co.uk/:path",
              permanent: true,
            },
            { source: "/mini-games/hangman", destination: "/mini-games", permanent: false },
            { source: "/mini-games/higher-lower", destination: "/mini-games", permanent: false },
            { source: "/stats", destination: "/profile", permanent: false },
          ];
        },
        // Baseline security headers (not supported by static export, so web only).
        async headers() {
          return [
            {
              // The service worker must never be cached, or updates to it get stuck.
              source: "/sw.js",
              headers: [
                { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                { key: "Content-Type", value: "application/javascript; charset=utf-8" },
              ],
            },
            {
              source: "/:path*",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "X-Frame-Options", value: "SAMEORIGIN" },
                {
                  key: "Permissions-Policy",
                  value: "camera=(), microphone=(), geolocation=(), payment=()",
                },
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
                },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
