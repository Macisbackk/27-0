/**
 * Welcome screen (v1.68, src/lib/entry-gate.ts) against a running build (default http://localhost:3000):
 *  1. Server HTML still carries the homepage (crawlers / no-JS) with the welcome hidden.
 *  2. First-time visitor: welcome shown, site chrome hidden, no sideways scroll (320 / 375 / desktop).
 *  3. CONTINUE AS GUEST → homepage; guest progress kept; reload → straight to the homepage.
 *  4. A player from before the welcome screen (existing 27-0 keys) never sees it.
 *  5. LOG IN → /login?redirect=/ with the site chrome back; Back → welcome again.
 *  6. Signed in → homepage; Log out (Settings) → welcome. Uses a fake stored session with the
 *     placeholder Supabase answered by route mocks; if that can't sign in, falls back to what
 *     signOut does to the device (session gone, flag "pending") and says so.
 *  7. Deep links (/play, challenge links, /manager, /login, /auth/callback, /privacy …) are never gated.
 * Fails on any problem or page error. CI: screenshots to e2e-shots/welcome-*.png.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
const SUPABASE_HOST = new URL(SUPABASE_URL).hostname;
const SESSION_KEY = `sb-${SUPABASE_HOST.split(".")[0]}-auth-token`;
const ENTRY = "27-0-entry";
const timeout = 15_000;
const IGNORED = [/supabase/i, /Failed to fetch/i, /ERR_NAME_NOT_RESOLVED/i, /fetch failed/i, /Load failed/i, /net::ERR_/i, /_vercel\/insights/, /Failed to load resource/i, /\[career/, /leaderboard\].*failed/i, /\[auth\]/i, /sync failed/i, /cloud.*failed/i];

const problems = [];
const notes = [];
const note = (m) => {
  notes.push(m);
  console.log(`✓ ${m}`);
};
const problem = (m) => {
  problems.push(`[${where}] ${m}`);
  console.log(`✗ [${where}] ${m}`);
};
let where = "start";

const browser = await chromium.launch();
const PHONE = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };

async function newPage(options = PHONE) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on("pageerror", (err) => problems.push(`[${where}] page error: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !IGNORED.some((re) => re.test(msg.text()))) problems.push(`[${where}] console error: ${msg.text().slice(0, 300)}`);
  });
  return { context, page };
}

async function settle(page, ms = 800) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function shot(page, name) {
  if (!process.env.CI) return;
  mkdirSync("e2e-shots", { recursive: true });
  await page.screenshot({ path: `e2e-shots/welcome-${name}.png`, scale: "css" }).catch(() => {});
}

const welcomeAttr = (page) => page.evaluate(() => document.documentElement.getAttribute("data-entry"));
const flag = (page, key = ENTRY) => page.evaluate((k) => localStorage.getItem(k), key);
const welcomeVisible = (page) => page.locator(".welcome-gate").isVisible().catch(() => false);
const homeVisible = (page) => page.locator(".home-content").isVisible().catch(() => false);
const headerVisible = (page) => page.locator(".app-header").isVisible().catch(() => false);
const bottomNavVisible = (page) => page.getByRole("navigation", { name: "Main" }).isVisible().catch(() => false);

async function expectWelcome(page, label) {
  if ((await welcomeAttr(page)) !== "welcome") problem(`${label}: <html data-entry> is ${await welcomeAttr(page)}, expected "welcome"`);
  if (!(await welcomeVisible(page))) problem(`${label}: welcome screen not visible`);
  if (await homeVisible(page)) problem(`${label}: homepage visible behind the welcome screen`);
  if (await headerVisible(page)) problem(`${label}: header visible on the welcome screen`);
  if (await bottomNavVisible(page)) problem(`${label}: bottom nav visible on the welcome screen`);
}

async function expectHome(page, label) {
  if ((await welcomeAttr(page)) !== null) problem(`${label}: <html data-entry> is ${await welcomeAttr(page)}, expected none`);
  if (await welcomeVisible(page)) problem(`${label}: welcome screen showing`);
  if (!(await homeVisible(page))) problem(`${label}: homepage not visible`);
  if (!(await headerVisible(page))) problem(`${label}: header missing`);
}

/* ------------------------------------------------------------ 1) server HTML */
{
  where = "server HTML";
  const res = await fetch(`${BASE}/`);
  const html = await res.text();
  if (res.status !== 200) problem(`GET / → ${res.status}`);
  if (!html.includes("welcome-gate")) problem("welcome screen markup missing from the home page HTML");
  if (!/rugby league manager and squad builder/i.test(html)) problem("homepage heading missing from the HTML (crawlers / no-JS)");
  if (!html.includes('id="entry-bootstrap"')) problem("entry bootstrap script missing from <head>");
  if (/<html[^>]*data-entry=/.test(html)) problem("server HTML already gates (data-entry must only be set in the browser)");
  note("Server HTML: homepage content + hidden welcome markup + bootstrap script");
}

/* ------------------------------------------------------------ 2) first visit, every width */
for (const [name, options] of [
  ["320", { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true }],
  ["375", PHONE],
  ["desktop", { viewport: { width: 1280, height: 800 } }],
]) {
  where = `first visit @${name}`;
  const { context, page } = await newPage(options);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  // Set during HTML parsing, before the app's JavaScript: no homepage flash.
  if ((await welcomeAttr(page)) !== "welcome") problem("welcome not set by the time the DOM is parsed");
  await settle(page);
  await expectWelcome(page, "first visit");
  const text = await page.locator(".welcome-gate").innerText().catch(() => "");
  if (!text.includes("The game starts here.")) problem(`tagline missing (got "${text.replace(/\s+/g, " ").slice(0, 80)}")`);
  const login = page.getByRole("link", { name: /^log in$/i });
  const guest = page.getByRole("button", { name: /^continue as guest$/i });
  if (!(await login.isVisible().catch(() => false))) problem("LOG IN missing");
  if (!(await guest.isVisible().catch(() => false))) problem("CONTINUE AS GUEST missing");
  for (const [label, el] of [["LOG IN", login], ["CONTINUE AS GUEST", guest]]) {
    const box = await el.boundingBox().catch(() => null);
    if (box && box.height < 44) problem(`${label} is ${Math.round(box.height)}px tall (needs 44+)`);
  }
  if (!(await page.locator(".welcome-gate .logo-mark").isVisible().catch(() => false))) problem("27-0 mark missing");
  const { sw, cw, sh, ch } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    sh: document.documentElement.scrollHeight,
    ch: document.documentElement.clientHeight,
  }));
  if (sw > cw + 1) problem(`sideways scroll: ${sw}px in ${cw}px`);
  if (sh > ch + 2 && name !== "320") problem(`welcome screen scrolls (${sh}px in ${ch}px)`);
  if ((await flag(page)) !== "pending") problem(`entry flag is ${await flag(page)}, expected "pending" until a choice is made`);
  await shot(page, `first-${name}`);
  await context.close();
}
note("First visit: welcome shown before paint, chrome hidden, fits 320 / 375 / desktop");

/* ------------------------------------------------------------ 3) guest entry + progress + reload */
{
  where = "guest entry";
  const { context, page } = await newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await expectWelcome(page, "before choosing");
  // Leaving without choosing (the site wrote its own keys meanwhile) still shows it next time.
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page, 500);
  await expectWelcome(page, "reload before choosing");
  // Guest progress made so far (e.g. a Classic run's stats) must survive the choice.
  await page.evaluate(() => localStorage.setItem("27-0-e2e-guest-progress", JSON.stringify({ seasons: 3, funds: 12345 })));
  const keysBefore = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("27-0-")));
  await page.getByRole("button", { name: /^continue as guest$/i }).click();
  await page.waitForTimeout(300);
  await expectHome(page, "after CONTINUE AS GUEST");
  if (!(await bottomNavVisible(page))) problem("bottom nav missing after entering as guest");
  if ((await flag(page)) !== "guest") problem(`entry flag is ${await flag(page)}, expected "guest"`);
  if (!(await page.getByRole("link", { name: /log in to save/i }).isVisible().catch(() => false))) problem('guest "Log in to save" chip missing (guests must still be able to sign in later)');
  await shot(page, "guest-home");

  where = "returning guest";
  await page.reload({ waitUntil: "domcontentloaded" });
  if ((await welcomeAttr(page)) !== null) problem("welcome set on reload for a guest");
  await settle(page);
  await expectHome(page, "reload as guest");
  const kept = await page.evaluate(() => localStorage.getItem("27-0-e2e-guest-progress"));
  if (kept !== JSON.stringify({ seasons: 3, funds: 12345 })) problem(`guest progress lost (got ${kept})`);
  const keysAfter = await page.evaluate(() => Object.keys(localStorage));
  const lost = keysBefore.filter((k) => k !== ENTRY && !keysAfter.includes(k));
  if (lost.length) problem(`keys lost through the welcome flow: ${lost.join(", ")}`);
  // Client-side navigation back to "/" from another page doesn't bring it back either.
  await page.goto(`${BASE}/mini-games`, { waitUntil: "domcontentloaded" });
  await settle(page, 500);
  await page.locator('a[href="/"]').first().click().catch(() => {});
  await page.waitForURL(`${BASE}/`, { timeout }).catch(() => {});
  await settle(page, 500);
  await expectHome(page, "client-side nav home as guest");
  await context.close();
  note("Guest: CONTINUE AS GUEST → homepage, progress kept, reload and in-app nav go straight home");
}

/* ------------------------------------------------------------ 4) players from before v1.68 */
{
  where = "existing player";
  const { context, page } = await newPage();
  await context.addInitScript(() => {
    try {
      if (!localStorage.getItem("27-0-stats")) localStorage.setItem("27-0-stats", JSON.stringify({}));
    } catch {
      /* about:blank */
    }
  });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  if ((await welcomeAttr(page)) !== null) problem("an existing player got the welcome screen");
  await settle(page);
  await expectHome(page, "existing player");
  if ((await flag(page)) !== "guest") problem(`existing player remembered as ${await flag(page)}, expected "guest"`);
  await context.close();
  note("Existing players (27-0 progress on the device) go straight to the homepage");
}

/* ------------------------------------------------------------ 5) LOG IN */
{
  where = "log in button";
  const { context, page } = await newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.getByRole("link", { name: /^log in$/i }).click();
  const moved = await page.waitForURL(/\/login\/?\?redirect=(%2F|\/)$/, { timeout }).then(() => true).catch(() => false);
  if (!moved) problem(`LOG IN went to ${page.url().replace(BASE, "")}, expected /login?redirect=/`);
  await settle(page);
  if ((await welcomeAttr(page)) !== null) problem("welcome attribute left on the login page");
  if (!(await headerVisible(page))) problem("header hidden on the login page");
  if (!(await page.getByRole("heading", { name: /^log in$/i }).first().isVisible().catch(() => false))) problem("login page heading missing");
  if (!(await page.locator('input[type="email"], input[type="password"]').first().isVisible().catch(() => false))) problem("login form missing");
  await shot(page, "login");
  await page.goBack({ waitUntil: "domcontentloaded" });
  await settle(page);
  await expectWelcome(page, "Back from login without signing in");
  await context.close();
  note("LOG IN → /login?redirect=/ (chrome back); Back without signing in → welcome again");
}

/* ------------------------------------------------------------ 6) signed in → log out → welcome */
{
  where = "sign out";
  const { context, page } = await newPage();
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: "00000000-0000-4000-8000-00000000e2e0",
    aud: "authenticated",
    role: "authenticated",
    email: "e2e-welcome@example.com",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { coach_name: "E2E Welcome" },
    created_at: new Date().toISOString(),
  };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const accessToken = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, exp: now + 86400, role: "authenticated", aud: "authenticated", email: user.email })}.e2e`;
  const session = { access_token: accessToken, refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 86400, expires_at: now + 86400, user };
  // The placeholder Supabase: answer every call so the fake session is never refreshed away.
  await context.route((url) => url.hostname === SUPABASE_HOST, (route) => {
    const url = route.request().url();
    if (url.includes("/auth/v1/logout")) return route.fulfill({ status: 204, body: "" });
    if (url.includes("/auth/v1/user")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
    if (url.includes("/auth/v1/token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await context.addInitScript(
    ([key, value]) => {
      try {
        if (sessionStorage.getItem("e2e-seeded")) return;
        sessionStorage.setItem("e2e-seeded", "1");
        localStorage.setItem(key, value);
      } catch {
        /* about:blank */
      }
    },
    [SESSION_KEY, JSON.stringify(session)]
  );
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  if ((await welcomeAttr(page)) !== null) problem("a signed-in coach got the welcome screen");
  await settle(page, 1500);
  await expectHome(page, "signed in");
  const signedIn = await page.waitForFunction((k) => localStorage.getItem(k) === "account", ENTRY, { timeout: 10_000 }).then(() => true).catch(() => false);
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await settle(page, 1200);
  const logout = page.getByRole("button", { name: /^log out$/i }).first();
  const canLogOut = signedIn && (await logout.isVisible().catch(() => false));
  if (canLogOut) {
    await logout.click();
    await page.waitForURL(`${BASE}/`, { timeout }).catch(() => problem(`Log out stayed on ${page.url().replace(BASE, "")}`));
    await settle(page);
    await expectWelcome(page, "after Log out");
    if ((await flag(page)) !== "pending") problem(`entry flag after Log out is ${await flag(page)}, expected "pending"`);
    if (await flag(page, SESSION_KEY)) problem("session still stored after Log out");
    await shot(page, "after-logout");
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page, 500);
    await expectWelcome(page, "reload after Log out");
    note("Signed in → homepage (flag account); Settings → Log out → welcome (and after reload)");
  } else {
    // Couldn't sign in against the placeholder: do to the device what signOut does.
    await page.evaluate(([key, entry]) => {
      localStorage.removeItem(key);
      localStorage.setItem(entry, "pending");
    }, [SESSION_KEY, ENTRY]);
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await expectWelcome(page, "after sign-out (simulated)");
    note(`Sign out SIMULATED (fake session ${signedIn ? "signed in but no Log out button" : "didn't sign in"}): session removed + flag "pending" → welcome`);
  }
  await context.close();
}

/* ------------------------------------------------------------ 7) deep links */
{
  const DEEP = ["/play", "/play?challenge=broken-link.x", "/play?daily=1", "/manager", "/mini-games", "/mini-games/wordle", "/login", "/auth/callback", "/privacy", "/profile", "/leaderboard"];
  const { context, page } = await newPage();
  for (const route of DEEP) {
    where = `deep link ${route}`;
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    if ((await welcomeAttr(page)) !== null) problem("welcome attribute set on a deep link");
    await settle(page, 600);
    if (await welcomeVisible(page)) problem("welcome screen shown on a deep link");
    if ((await page.evaluate(() => document.documentElement.getAttribute("data-entry"))) !== null) problem("welcome attribute set after load");
    // The page itself is there (not a blank screen).
    const text = await page.locator("main").innerText().catch(() => "");
    if (text.trim().length < 10) problem("page is blank");
  }
  // Email-confirmation landing on "/" goes straight in too.
  where = "email link on /";
  await page.evaluate(() => localStorage.clear()).catch(() => {});
  await page.goto(`${BASE}/?emailConfirmed=1`, { waitUntil: "domcontentloaded" });
  if ((await welcomeAttr(page)) !== null) problem("welcome shown on an email-confirmation landing");
  await context.close();
  note(`Deep links never gated (${DEEP.length} routes) and email-link landings go straight in`);
}

await browser.close();
const unique = [...new Set(problems)];
if (process.env.CI) {
  mkdirSync("e2e-shots", { recursive: true });
  writeFileSync("e2e-shots/welcome-report.txt", `${unique.length} problem(s)\n${unique.join("\n")}\n\nChecks:\n${notes.join("\n")}\n`);
}
if (unique.length) {
  console.error(`\n${unique.length} problem(s):\n${unique.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`\nWelcome screen e2e: all ${notes.length} checks passed`);
