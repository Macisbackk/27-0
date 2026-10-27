import { APP_URL_SCHEME, isNativeApp } from "@/lib/native/platform";

const PRODUCTION_SITE = "https://www.27-0.co.uk";

/**
 * Where email links (confirm, password reset) should land.
 * In the installed app the page origin is https://localhost / capacitor://localhost, which an email
 * link can't open, so the app asks Supabase to send people back into the app through its own URL
 * scheme (com.twentysevenzero.game://auth/...). If that address isn't on the Supabase "Redirect URLs"
 * allow list yet, Supabase falls back to the Site URL (the live website), so nothing breaks.
 */
function siteOrigin(): string {
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    const isAppShell = origin === "https://localhost" || origin === "capacitor://localhost" || origin.startsWith("file:");
    if (!isAppShell) return origin;
  }
  return (process.env.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_SITE).replace(/\/$/, "");
}

function appOrWebUrl(path: "/auth/callback" | "/auth/reset-password"): string {
  if (typeof window !== "undefined" && isNativeApp()) return `${APP_URL_SCHEME}:/${path}`;
  return `${siteOrigin()}${path}`;
}

/** Redirect target for Supabase email confirmation links. */
export function getEmailConfirmRedirectUrl(): string {
  return appOrWebUrl("/auth/callback");
}

/** Redirect target for Supabase password reset links. */
export function getPasswordResetRedirectUrl(): string {
  return appOrWebUrl("/auth/reset-password");
}
