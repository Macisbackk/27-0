import type { NextConfig } from "next";
import path from "path";

/** Set CAPACITOR_BUILD=1 for the packaged Android (static) export. */
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
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
        // Baseline security headers (not supported by static export, so web only).
        async headers() {
          return [
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
