const PRODUCTION_SITE = "https://27-0.co.uk";

/**
 * Where email links (confirm, password reset) should land.
 * In the installed app the page origin is https://localhost, which an email link can't open,
 * so the app always sends people to the live site instead.
 */
function siteOrigin(): string {
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    const isAppShell = origin === "https://localhost" || origin === "capacitor://localhost" || origin.startsWith("file:");
    if (!isAppShell) return origin;
  }
  return (process.env.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_SITE).replace(/\/$/, "");
}

/** Redirect target for Supabase email confirmation links. */
export function getEmailConfirmRedirectUrl(): string {
  return `${siteOrigin()}/auth/callback`;
}

/** Redirect target for Supabase password reset links. */
export function getPasswordResetRedirectUrl(): string {
  return `${siteOrigin()}/auth/reset-password`;
}
