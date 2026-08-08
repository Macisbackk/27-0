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
    : {}),
};

export default nextConfig;
