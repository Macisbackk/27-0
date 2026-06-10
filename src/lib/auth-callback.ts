const EMAIL_CONFIRM_SHOWN_KEY = "27-0-email-confirm-shown";
const EMAIL_CONFIRM_PENDING_KEY = "27-0-email-confirm-pending";

export function markEmailConfirmPending(): void {
  sessionStorage.setItem(EMAIL_CONFIRM_PENDING_KEY, "1");
}

/** Detect Supabase email-confirmation redirect in URL hash or query. */
export function detectPasswordRecoveryRedirect(): boolean {
  if (typeof window === "undefined") return false;

  const search = new URLSearchParams(window.location.search);
  if (search.get("type") === "recovery") return true;

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  return hashParams.get("type") === "recovery";
}

export function detectEmailConfirmationRedirect(): boolean {
  if (typeof window === "undefined") return false;

  if (detectPasswordRecoveryRedirect()) return false;

  const search = new URLSearchParams(window.location.search);
  if (search.get("emailConfirmed") === "1") return true;

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const type = hashParams.get("type");
  if (type === "signup" || type === "email" || type === "magiclink") {
    return true;
  }

  if (search.has("code") || search.get("confirmed") === "true") {
    return true;
  }

  return false;
}

export function shouldShowEmailConfirmBanner(): boolean {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(EMAIL_CONFIRM_SHOWN_KEY) === "1") return false;
  return (
    sessionStorage.getItem(EMAIL_CONFIRM_PENDING_KEY) === "1" ||
    detectEmailConfirmationRedirect()
  );
}

export function markEmailConfirmBannerShown(): void {
  sessionStorage.setItem(EMAIL_CONFIRM_SHOWN_KEY, "1");
  sessionStorage.removeItem(EMAIL_CONFIRM_PENDING_KEY);
  cleanAuthRedirectFromUrl();
}

export function cleanAuthRedirectFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete("code");
  url.searchParams.delete("confirmed");
  url.searchParams.delete("emailConfirmed");
  const qs = url.searchParams.toString();
  window.history.replaceState({}, "", qs ? `${url.pathname}?${qs}` : url.pathname);
}
