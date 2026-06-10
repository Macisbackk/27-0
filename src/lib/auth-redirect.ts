const PRODUCTION_SITE = "https://27-0.co.uk";

function getAuthCallbackUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_SITE;
  return `${site.replace(/\/$/, "")}/auth/callback`;
}

/** Redirect target for Supabase email confirmation links. */
export function getEmailConfirmRedirectUrl(): string {
  return getAuthCallbackUrl();
}

/** Redirect target for Supabase password reset links. */
export function getPasswordResetRedirectUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/reset-password`;
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_SITE;
  return `${site.replace(/\/$/, "")}/auth/reset-password`;
}
