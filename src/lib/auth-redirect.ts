const PRODUCTION_SITE = "https://27-0.co.uk";

/** Redirect target for Supabase email confirmation links. */
export function getEmailConfirmRedirectUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_SITE;
  return `${site.replace(/\/$/, "")}/auth/callback`;
}
