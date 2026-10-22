import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the Next.js static export (`out/`) for Android and iOS.
 * Web / Vercel continues to use `next build` without CAPACITOR_BUILD.
 */
const config: CapacitorConfig = {
  appId: "com.twentysevenzero.game",
  appName: "27-0",
  webDir: "out",
  ios: {
    backgroundColor: "#0a110e",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0a110e",
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0a110e",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Light content (icons) on dark #0a110e background.
      style: "LIGHT",
      backgroundColor: "#0a110e",
    },
  },
};

export default config;
