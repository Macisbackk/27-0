import { Capacitor } from "@capacitor/core";

/**
 * True in the packaged iPhone / Android app build (`npm run build:mobile`, CAPACITOR_BUILD=1).
 * Baked in at build time, so anything gated on it is simply not rendered in the app
 * (no flash on first paint, no hydration mismatch) and the website build is untouched.
 */
export const IS_APP_BUILD = process.env.NEXT_PUBLIC_APP_BUILD === "1";

/** Custom URL scheme the app registers (Info.plist CFBundleURLTypes / AndroidManifest intent filter). */
export const APP_URL_SCHEME = "com.twentysevenzero.game";

/** Running inside the native Capacitor shell (iOS or Android), checked at runtime. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function nativePlatform(): "ios" | "android" | "web" {
  try {
    const p = Capacitor.getPlatform();
    return p === "ios" || p === "android" ? p : "web";
  } catch {
    return "web";
  }
}

/**
 * Hide external tip / donation links (Buy Me a Coffee) in the store apps.
 * Apple (Guideline 3.1.1 / 3.2.2) and Google Play's payments policy don't allow linking out to
 * pay or tip the developer from inside an app. The website keeps them.
 */
export const SHOW_TIP_LINKS = !IS_APP_BUILD;

/** Inline script (runs before React) that tags <html> when inside the native shell, so CSS can respect notches from the first paint. */
export const NATIVE_CLASS_BOOTSTRAP_SCRIPT = `(function(){try{var C=window.Capacitor;if(C&&C.isNativePlatform&&C.isNativePlatform()){var h=document.documentElement;h.classList.add("capacitor-native");h.classList.add("capacitor-"+C.getPlatform());}}catch(e){}})();`;
