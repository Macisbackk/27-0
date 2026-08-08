import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the Next.js static export (`out/`) for Android.
 * Web / Vercel continues to use `next build` without CAPACITOR_BUILD.
 */
const config: CapacitorConfig = {
  appId: "com.twentysevenzero.game",
  appName: "27-0",
  webDir: "out",
  android: {
    allowMixedContent: false,
    backgroundColor: "#0a0f0d",
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0a0f0d",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Light content (icons) on dark #0a0f0d background.
      style: "LIGHT",
      backgroundColor: "#0a0f0d",
    },
  },
};

export default config;
