/**
 * Welcome screen gate (src/lib/entry-gate.ts): who sees it, the pre-paint bootstrap script agreeing
 * with decideEntry, the guest / sign-in / sign-out flag flow, and guest progress surviving the
 * first sign-in (account-owner.ts). The browser flow is in scripts/e2e-welcome.mjs; a real sign-in
 * can't run in CI (Supabase is a placeholder there), so the account side is covered here.
 * Run: bun scripts/test-entry-gate.ts
 */
class MemoryStorage {
  private values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  key(i: number): string | null {
    return [...this.values.keys()][i] ?? null;
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  clear(): void {
    this.values.clear();
  }
}

class FakeRoot {
  attrs = new Map<string, string>();
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  getAttribute(k: string) {
    return this.attrs.get(k) ?? null;
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
  }
}

const store = new MemoryStorage();
const root = new FakeRoot();
const fakeLocation = { pathname: "/", search: "", hash: "" };
const fakeNavigator = { userAgent: "Mozilla/5.0 (iPhone) Safari/605.1" };
Object.assign(globalThis, {
  window: globalThis,
  localStorage: store,
  document: { documentElement: root, getElementById: () => null },
  location: fakeLocation,
  navigator: fakeNavigator,
});

const gate = await import("../src/lib/entry-gate");
const { claimDeviceForAccount, ACCOUNT_STORAGE_KEYS } = await import("../src/lib/storage/account-owner");
const { STORAGE_KEYS } = await import("../src/lib/storage/keys");
const { decideEntry, ENTRY_BOOTSTRAP_SCRIPT, ENTRY_FLAG_KEY } = gate;

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean): void {
  checks++;
  if (!ok) {
    failures++;
    console.error("FAIL", name);
  }
}

const base = { path: "/", flag: null, hasSession: false, hasExistingProgress: false, isBot: false, authRedirect: false };

/* ── decideEntry ────────────────────────────────────────────────────────── */
check("first visit → welcome, flag pending", JSON.stringify(decideEntry(base)) === JSON.stringify({ show: true, writeFlag: "pending" }));
check("shown but not chosen → welcome again", decideEntry({ ...base, flag: "pending", hasExistingProgress: true }).show);
check("returning guest → homepage", !decideEntry({ ...base, flag: "guest" }).show);
check("signed in before → homepage", !decideEntry({ ...base, flag: "account" }).show);
check("corrupted flag never traps", !decideEntry({ ...base, flag: "{garbage" }).show);
const legacy = decideEntry({ ...base, hasExistingProgress: true });
check("player from before the welcome screen → homepage, remembered as guest", !legacy.show && legacy.writeFlag === "guest");
check("signed-in session → homepage", !decideEntry({ ...base, hasSession: true }).show);
check("signed-in session beats pending", !decideEntry({ ...base, hasSession: true, flag: "pending" }).show);
check("crawler → homepage", !decideEntry({ ...base, isBot: true }).show);
check("email sign-in link → homepage", !decideEntry({ ...base, authRedirect: true }).show);
for (const path of ["/play", "/play/", "/manager", "/login", "/login/", "/auth/callback", "/privacy", "/mini-games/wordle", "/modes"]) {
  const d = decideEntry({ ...base, path });
  check(`deep link ${path} never gated or flagged`, !d.show && d.writeFlag === null);
}
check("static export index.html is home", decideEntry({ ...base, path: "/index.html" }).show);

/* ── helpers ────────────────────────────────────────────────────────────── */
check("bot UA", gate.isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)") && gate.isBotUserAgent("Mozilla/5.0 Chrome-Lighthouse"));
check("people aren't bots", !gate.isBotUserAgent(fakeNavigator.userAgent) && !gate.isBotUserAgent("Mozilla/5.0 HeadlessChrome/131"));
check("auth hash", gate.isAuthRedirectUrl("", "#access_token=x&type=signup"));
check("auth code", gate.isAuthRedirectUrl("?code=abc", ""));
check("plain url", !gate.isAuthRedirectUrl("?utm_source=x", ""));
const scan = gate.scanStorageKeys(["sb-abc-auth-token", ENTRY_FLAG_KEY]);
check("session key seen, entry flag isn't progress", scan.hasSession && !scan.hasExistingProgress);
check("27-0 key is progress", gate.scanStorageKeys(["27-0-stats"]).hasExistingProgress);
check("other site keys aren't progress", !gate.scanStorageKeys(["ally-supports-cache", "sb-abc-auth-token-code-verifier"]).hasExistingProgress);

/* ── the bootstrap script agrees with decideEntry ───────────────────────── */
function runBootstrap(): void {
  new Function("document", "localStorage", "location", "navigator", ENTRY_BOOTSTRAP_SCRIPT)(
    { documentElement: root },
    store,
    fakeLocation,
    fakeNavigator
  );
}
type Scenario = { name: string; path?: string; flag?: string; keys?: string[]; ua?: string; search?: string; hash?: string };
const scenarios: Scenario[] = [
  { name: "fresh" },
  { name: "pending", flag: "pending", keys: ["27-0-stats"] },
  { name: "guest", flag: "guest" },
  { name: "account", flag: "account" },
  { name: "junk flag", flag: "{" },
  { name: "legacy progress", keys: ["27-0-cosmetics-store", "27-0-club-funds"] },
  { name: "session", keys: ["sb-xyz-auth-token"] },
  { name: "session + pending", flag: "pending", keys: ["sb-xyz-auth-token"] },
  { name: "bot", ua: "Googlebot/2.1" },
  { name: "auth hash", hash: "#access_token=a&type=signup" },
  { name: "auth code", search: "?code=1" },
  { name: "deep link", path: "/play" },
  { name: "deep link pending", path: "/play", flag: "pending" },
  { name: "challenge link", path: "/play", search: "?challenge=abc" },
  { name: "index.html", path: "/index.html" },
];
for (const sc of scenarios) {
  const setup = () => {
    store.clear();
    root.attrs.clear();
    if (sc.flag != null) store.setItem(ENTRY_FLAG_KEY, sc.flag);
    for (const k of sc.keys ?? []) store.setItem(k, "{}");
    fakeLocation.pathname = sc.path ?? "/";
    fakeLocation.search = sc.search ?? "";
    fakeLocation.hash = sc.hash ?? "";
    fakeNavigator.userAgent = sc.ua ?? "Mozilla/5.0 (iPhone) Safari/605.1";
  };
  setup();
  const expected = decideEntry(gate.readEntryInput(fakeLocation.pathname));
  const flagBefore = store.getItem(ENTRY_FLAG_KEY);
  runBootstrap();
  const shown = root.getAttribute("data-entry") === "welcome";
  check(`bootstrap shows = decideEntry (${sc.name})`, shown === expected.show);
  check(`bootstrap flag = decideEntry (${sc.name})`, store.getItem(ENTRY_FLAG_KEY) === (expected.writeFlag ?? flagBefore));
  // The client-side gate (WelcomeScreen) applied on top agrees too.
  setup();
  if (gate.isHomePath(fakeLocation.pathname)) {
    gate.applyEntryGate(fakeLocation.pathname);
    check(`applyEntryGate = decideEntry (${sc.name})`, gate.isWelcomeVisible() === expected.show);
  }
}
{
  // Storage that throws (private mode / blocked): nothing breaks, nobody gated.
  const throwing = { get length() { throw new Error("blocked"); }, getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, key() { return null; } };
  root.attrs.clear();
  fakeLocation.pathname = "/";
  let threw = false;
  try {
    new Function("document", "localStorage", "location", "navigator", ENTRY_BOOTSTRAP_SCRIPT)({ documentElement: root }, throwing, fakeLocation, fakeNavigator);
  } catch {
    threw = true;
  }
  check("bootstrap survives blocked storage", !threw && root.getAttribute("data-entry") === null);
}

/* ── the whole journey ──────────────────────────────────────────────────── */
store.clear();
root.attrs.clear();
fakeLocation.pathname = "/";
fakeLocation.search = "";
fakeLocation.hash = "";
fakeNavigator.userAgent = "Mozilla/5.0 (iPhone) Safari/605.1";

runBootstrap();
check("journey: first visit sees welcome", gate.isWelcomeVisible());
// The site writes its own keys during that first visit…
store.setItem("27-0-sound-muted", "0");
root.attrs.clear();
runBootstrap();
check("journey: left without choosing → welcome again", gate.isWelcomeVisible());

// CONTINUE AS GUEST, then play a little.
gate.markEntered("guest");
check("journey: guest hides welcome", !gate.isWelcomeVisible());
store.setItem(STORAGE_KEYS.clubFunds, JSON.stringify({ balance: 12345 }));
store.setItem(STORAGE_KEYS.stats, JSON.stringify({ seasons: 3 }));
root.attrs.clear();
runBootstrap();
check("journey: returning guest goes straight to homepage", !gate.isWelcomeVisible());

// Later signs in (auth-context: markEntered("account") then claimDeviceForAccount).
store.setItem("sb-xyz-auth-token", "{}");
gate.markEntered("account");
const cleared = claimDeviceForAccount("user-a");
check("journey: guest progress kept on first sign-in", !cleared && store.getItem(STORAGE_KEYS.clubFunds) !== null && store.getItem(STORAGE_KEYS.stats) !== null);
check("journey: device now belongs to the account", store.getItem("27-0-account-owner") === "user-a");
root.attrs.clear();
runBootstrap();
check("journey: signed in → homepage", !gate.isWelcomeVisible());

// Log out (auth-context signOut: Supabase drops the session, then resetEntryAfterSignOut).
store.removeItem("sb-xyz-auth-token");
gate.resetEntryAfterSignOut();
root.attrs.clear();
runBootstrap();
check("journey: signed out → welcome again", gate.isWelcomeVisible());
check("journey: progress still on the device after sign-out", store.getItem(STORAGE_KEYS.clubFunds) !== null);

// Another account signs in on this phone: A's progress is dropped (unchanged behaviour), not the entry flag.
store.setItem("sb-xyz-auth-token", "{}");
gate.markEntered("account");
check("journey: second account clears the first's progress", claimDeviceForAccount("user-b") && store.getItem(STORAGE_KEYS.clubFunds) === null);
check("entry flag is device-level, not account data", !ACCOUNT_STORAGE_KEYS.includes(ENTRY_FLAG_KEY) && store.getItem(ENTRY_FLAG_KEY) === "account");

if (failures) {
  console.error(`\n${failures}/${checks} entry-gate checks failed`);
  process.exit(1);
}
console.log(`entry-gate: ${checks} checks passed`);
