/**
 * Welcome screen gate (v1.68): who sees the "LOG IN / CONTINUE AS GUEST" screen on "/".
 *
 * Only a first-time visitor on the home page sees it. Everyone else goes straight to the homepage:
 *   - a signed-in player (Supabase keeps the session in localStorage as `sb-<ref>-auth-token`);
 *   - a player who already chose (the `27-0-entry` flag: "guest" or "account");
 *   - a player from before the welcome screen existed (any other `27-0-…` key = existing progress);
 *   - crawlers, and anyone arriving from an email sign-in link (auth params in the URL).
 * Deep links (/play, challenge links, /login, /auth/callback, /privacy …) are never gated.
 *
 * The decision is made twice with the same rules: before paint by ENTRY_BOOTSTRAP_SCRIPT (full page
 * loads; sets `data-entry="welcome"` on <html>, which CSS uses to show the screen and hide the site
 * chrome, so there's no flash either way), and by WelcomeScreen on client-side navigation to "/".
 * Without JavaScript nothing is set and the homepage shows as normal.
 *
 * "pending" marks a visitor who has been shown the screen but not chosen yet, so the progress keys
 * the site writes on that first visit don't turn them into a "returning guest". Signing out sets it
 * again, so a signed-out player comes back to the welcome screen.
 *
 * Pure helpers (no React, no Supabase) so scripts/test-entry-gate.ts can import them.
 */

export const ENTRY_FLAG_KEY = "27-0-entry";
export const ENTRY_ATTRIBUTE = "data-entry";
export const ENTRY_WELCOME_VALUE = "welcome";

export type EntryFlag = "guest" | "account" | "pending";

export interface EntryGateInput {
  /** location.pathname */
  path: string;
  /** Stored `27-0-entry` value (any string: a corrupted value must never trap anyone). */
  flag: string | null;
  /** A Supabase session is stored on this device. */
  hasSession: boolean;
  /** Any other 27-0 key: this device has played before the welcome screen existed. */
  hasExistingProgress: boolean;
  /** Search engine / link-preview crawler. */
  isBot: boolean;
  /** Landing from a Supabase email link (confirm, magic link, recovery, error). */
  authRedirect: boolean;
}

export interface EntryDecision {
  show: boolean;
  /** Value to store in `27-0-entry`, or null to leave it as it is. */
  writeFlag: EntryFlag | null;
}

const NO: EntryDecision = { show: false, writeFlag: null };

export function isHomePath(path: string): boolean {
  return path === "/" || path === "" || path === "/index.html";
}

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|embedly|lighthouse|inspectiontool/i;
export function isBotUserAgent(ua: string): boolean {
  return BOT_RE.test(ua);
}

const AUTH_SEARCH_RE = /[?&](code|type|emailConfirmed|confirmed|error|error_description)=/;
const AUTH_HASH_RE = /(access_token|type|error)=/;
export function isAuthRedirectUrl(search: string, hash: string): boolean {
  return AUTH_SEARCH_RE.test(search) || AUTH_HASH_RE.test(hash);
}

const SESSION_KEY_RE = /^sb-.+-auth-token$/;
/** What the stored keys say about this device. */
export function scanStorageKeys(keys: readonly string[]): { hasSession: boolean; hasExistingProgress: boolean } {
  let hasSession = false;
  let hasExistingProgress = false;
  for (const key of keys) {
    if (SESSION_KEY_RE.test(key)) hasSession = true;
    else if (key.startsWith("27-0-") && key !== ENTRY_FLAG_KEY) hasExistingProgress = true;
  }
  return { hasSession, hasExistingProgress };
}

/** The gate. Keep ENTRY_BOOTSTRAP_SCRIPT in step (scripts/test-entry-gate.ts checks they agree). */
export function decideEntry(input: EntryGateInput): EntryDecision {
  if (!isHomePath(input.path)) return NO;
  if (input.isBot || input.authRedirect) return NO;
  if (input.hasSession) return NO;
  if (input.flag === "pending") return { show: true, writeFlag: null };
  // "guest", "account" — or anything unreadable: never trap a player on the welcome screen.
  if (input.flag != null) return NO;
  // Played before the welcome screen existed: a returning guest.
  if (input.hasExistingProgress) return { show: false, writeFlag: "guest" };
  return { show: true, writeFlag: "pending" };
}

/**
 * Inline, before paint (layout.tsx, beforeInteractive). Same rules as decideEntry; uses only the
 * `document`, `localStorage`, `location` and `navigator` globals so the test can run it.
 */
export const ENTRY_BOOTSTRAP_SCRIPT = `(function(){try{var K=${JSON.stringify(ENTRY_FLAG_KEY)};var p=location.pathname||"";if(!(p==="/"||p===""||p==="/index.html"))return;if(${BOT_RE.toString()}.test(navigator.userAgent||""))return;if(${AUTH_SEARCH_RE.toString()}.test(location.search||"")||${AUTH_HASH_RE.toString()}.test(location.hash||""))return;var f=localStorage.getItem(K),s=false,g=false;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!k)continue;if(${SESSION_KEY_RE.toString()}.test(k))s=true;else if(k.indexOf("27-0-")===0&&k!==K)g=true;}if(s)return;var show=false,w=null;if(f==="pending")show=true;else if(f!=null){}else if(g)w="guest";else{show=true;w="pending";}if(w)localStorage.setItem(K,w);if(show)document.documentElement.setAttribute(${JSON.stringify(ENTRY_ATTRIBUTE)},${JSON.stringify(ENTRY_WELCOME_VALUE)});}catch(e){}})();`;

/* ── Browser helpers ─────────────────────────────────────────────────────── */

function storageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) keys.push(key);
  }
  return keys;
}

/** Reads this device's state for decideEntry. */
export function readEntryInput(path: string): EntryGateInput {
  let flag: string | null = null;
  let scan = { hasSession: false, hasExistingProgress: false };
  try {
    flag = localStorage.getItem(ENTRY_FLAG_KEY);
    scan = scanStorageKeys(storageKeys());
  } catch {
    // Storage blocked: treat as a returning player rather than gate them every visit.
    flag = "guest";
  }
  return {
    path,
    flag,
    ...scan,
    isBot: typeof navigator !== "undefined" && isBotUserAgent(navigator.userAgent || ""),
    authRedirect: typeof location !== "undefined" && isAuthRedirectUrl(location.search || "", location.hash || ""),
  };
}

function writeFlag(value: EntryFlag): void {
  try {
    localStorage.setItem(ENTRY_FLAG_KEY, value);
  } catch {
    /* storage blocked */
  }
}

export function setWelcomeVisible(visible: boolean): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (visible) root.setAttribute(ENTRY_ATTRIBUTE, ENTRY_WELCOME_VALUE);
  else root.removeAttribute(ENTRY_ATTRIBUTE);
}

export function isWelcomeVisible(): boolean {
  return typeof document !== "undefined" && document.documentElement.getAttribute(ENTRY_ATTRIBUTE) === ENTRY_WELCOME_VALUE;
}

/** Runs the gate for the home page now (client-side navigation) and applies it. */
export function applyEntryGate(path: string): boolean {
  const decision = decideEntry(readEntryInput(path));
  if (decision.writeFlag) writeFlag(decision.writeFlag);
  setWelcomeVisible(decision.show);
  return decision.show;
}

/** The player chose (or signed in): never show the welcome screen again on this device. */
export function markEntered(kind: "guest" | "account"): void {
  writeFlag(kind);
  setWelcomeVisible(false);
}

/** Signed out: the next visit to "/" shows the welcome screen again (local progress is kept). */
export function resetEntryAfterSignOut(): void {
  writeFlag("pending");
}
