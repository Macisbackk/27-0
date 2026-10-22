/**
 * Whole-site break test against a running build (default http://localhost:3000).
 *  1. Crawl every route at 320 / 375 / desktop widths: no page errors, no HTTP errors, no sideways scroll.
 *  2. Check every internal link found on the site resolves.
 *  3. Play each mode like a (careless) user: Classic Current + Era, Daily Challenge, Quiz, Wordle, Hangman, Higher/Lower.
 *  4. Corrupt every localStorage key the site wrote, then revisit every route: nothing may crash.
 * CI: screenshots of each route (375px) go to e2e-shots/site-*.png.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const ROUTES = [
  "/", "/play", "/play?era=1", "/play?daily=1", "/manager", "/mini-games", "/mini-games/quiz", "/mini-games/wordle",
  "/mini-games/hangman", "/mini-games/higher-lower", "/quiz", "/leaderboard", "/stats", "/profile", "/store",
  "/showcase", "/settings", "/login", "/auth/callback", "/auth/reset-password",
];
const EXPECT_404 = ["/dev/mobile-ui", "/this-route-does-not-exist"];
const IGNORED = [/supabase/i, /Failed to fetch/i, /ERR_NAME_NOT_RESOLVED/i, /fetch failed/i, /Load failed/i, /net::ERR_/i, /_vercel\/insights/, /Failed to load resource/i, /\[career/, /leaderboard\].*failed/i, /\[auth\]/i, /sync failed/i, /cloud.*failed/i];
const IGNORED_URLS = [/\/_vercel\//, /supabase/i, /favicon/i, /\/sounds\/[\w-]+\.mp3$/];

const problems = [];
const notes = [];
const note = (m) => {
  notes.push(m);
  console.log(`✓ ${m}`);
};
let currentWhere = "start";
const timeout = 15_000;

const browser = await chromium.launch();

function wire(page) {
  page.on("pageerror", (err) => problems.push(`[${currentWhere}] page error: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !IGNORED.some((re) => re.test(msg.text()))) problems.push(`[${currentWhere}] console error: ${msg.text().slice(0, 300)}`);
  });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 400 && url.startsWith(BASE) && !IGNORED_URLS.some((re) => re.test(url)) && !EXPECT_404.some((p) => url.endsWith(p)))
      problems.push(`[${currentWhere}] HTTP ${res.status()} ${url.replace(BASE, "")}`);
  });
  return page;
}

async function settle(page, ms = 1200) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

async function sideways(page, where) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (sw > cw + 1) problems.push(`[${where}] sideways scroll: ${sw}px content in a ${cw}px screen`);
}

async function shot(page, name) {
  if (!process.env.CI) return;
  mkdirSync("e2e-shots", { recursive: true });
  await page.screenshot({ path: `e2e-shots/site-${name}.png`, scale: "css" }).catch(() => {});
}

/** Click the first visible, enabled button whose name matches one of the patterns. */
async function tapFirst(page, patterns) {
  for (const re of patterns) {
    const btn = page.getByRole("button", { name: re }).first();
    if ((await btn.isVisible().catch(() => false)) && (await btn.isEnabled().catch(() => false))) {
      await btn.click({ timeout: 5000 }).catch(() => {});
      return re.source;
    }
  }
  return null;
}

/* ------------------------------------------------------------ 1) crawl */
const internalLinks = new Set();
for (const vp of [
  { name: "320", width: 320, height: 640, mobile: true },
  { name: "375", width: 375, height: 812, mobile: true },
  { name: "desktop", width: 1280, height: 800, mobile: false },
]) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
  const page = wire(await context.newPage());
  for (const route of ROUTES) {
    currentWhere = `${route} @${vp.name}`;
    const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }).catch((e) => (problems.push(`[${currentWhere}] navigation failed: ${e.message}`), null));
    if (res && res.status() >= 400) problems.push(`[${currentWhere}] status ${res.status()}`);
    await settle(page);
    const title = await page.title();
    if (!title) problems.push(`[${currentWhere}] empty <title>`);
    if (vp.mobile) await sideways(page, currentWhere);
    if (vp.name === "375") await shot(page, route.replace(/[/?=]+/g, "_") || "home");
    for (const href of await page.$$eval("a[href^='/']", (as) => as.map((a) => a.getAttribute("href")))) internalLinks.add(href.split("#")[0]);
  }
  for (const route of EXPECT_404) {
    currentWhere = `${route} @${vp.name}`;
    const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    if (res?.status() !== 404) problems.push(`[${currentWhere}] expected 404, got ${res?.status()}`);
  }
  await context.close();
  note(`Crawled ${ROUTES.length} routes @${vp.name}`);
}

/* ------------------------------------------------------------ 2) links */
{
  const context = await browser.newContext();
  let checked = 0;
  for (const href of internalLinks) {
    if (!href || href.startsWith("//")) continue;
    currentWhere = `link ${href}`;
    const res = await context.request.get(`${BASE}${href}`, { maxRedirects: 5 }).catch(() => null);
    checked++;
    if (!res) problems.push(`[link] ${href} failed to load`);
    else if (res.status() >= 400 && !EXPECT_404.includes(href)) problems.push(`[link] ${href} → ${res.status()}`);
  }
  await context.close();
  note(`Checked ${checked} internal links`);
}

/* ------------------------------------------------------------ 3) play modes */
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
const page = wire(await context.newPage());

async function playClassic(route, label) {
  currentWhere = `${label} playthrough`;
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await settle(page, 1500);
  const seen = [];
  let reviewed = false;
  for (let i = 0; i < 60; i++) {
    const text = await page.locator("main").innerText().catch(() => "");
    if (/Regular Season Record|League Position|Season review/i.test(text) && !/Simulate season/i.test(text)) {
      reviewed = true;
      break;
    }
    const tapped = await tapFirst(page, [
      /Skip boost|Continue without boost/i, /Auto.?fill squad/i, /Simulate season/i, /Skip/i, /Sim(ulate)? (to )?(end|all|rest)/i,
      /^Continue$/i, /Next/i, /View (season )?review/i, /See (your )?review/i, /Finish/i,
    ]);
    if (tapped) seen.push(tapped.replace(/\\|\^|\$|\/i/g, ""));
    await page.waitForTimeout(tapped ? 900 : 1500);
  }
  if (!reviewed) problems.push(`[${label}] never reached the season review (taps: ${seen.slice(0, 12).join(" › ")})`);
  else note(`${label}: full run to review (${seen.length} taps)`);
  await shot(page, `${label.replace(/\W+/g, "-").toLowerCase()}-end`);
}

await playClassic("/play", "Classic Current");
await playClassic("/play?era=1", "Classic Era");
await playClassic("/play?daily=1", "Daily Challenge");

// Rapid taps on Auto Fill / Simulate at the start of a fresh run.
currentWhere = "Classic rapid taps";
await page.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
await settle(page);
await tapFirst(page, [/Skip boost|Continue without boost/i]);
for (let i = 0; i < 6; i++) await page.getByRole("button", { name: /Auto.?fill squad/i }).first().click({ force: true, noWaitAfter: true, timeout: 2000 }).catch(() => {});
for (let i = 0; i < 6; i++) await page.getByRole("button", { name: /Simulate season/i }).first().click({ force: true, noWaitAfter: true, timeout: 2000 }).catch(() => {});
await page.waitForTimeout(2500);
note("Classic: rapid Auto Fill / Simulate taps");

// Reload mid-run.
currentWhere = "Classic reload mid-run";
await page.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
await settle(page);
await tapFirst(page, [/Skip boost|Continue without boost/i]);
await tapFirst(page, [/Auto.?fill squad/i]);
await page.waitForTimeout(600);
await page.reload({ waitUntil: "domcontentloaded" });
await settle(page);
note("Classic: reload mid-run");

// Mini-games: pick a pool, make moves, mash buttons.
async function miniGame(route, label, moves) {
  currentWhere = `${label}`;
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await settle(page, 1500);
  await tapFirst(page, [/^Current/i, /Super League Millionaire|Normal Quiz/i]);
  await page.waitForTimeout(800);
  await moves();
  await shot(page, `${label.toLowerCase().replace(/\W+/g, "-")}-played`);
  note(`${label}: played`);
}

await miniGame("/mini-games/wordle", "Wordle", async () => {
  for (const guess of ["a", "Smith", "O'Brien", "Zz-z", "   ", "Sam Tomkins", "😀", "x".repeat(80)]) {
    const input = page.getByRole("combobox").or(page.locator("input[type='text'], input:not([type])")).first();
    if (!(await input.isVisible().catch(() => false))) break;
    await input.fill(guess);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await tapFirst(page, [/^Guess$/i]);
    await page.waitForTimeout(250);
  }
  for (let i = 0; i < 4; i++) await tapFirst(page, [/Reveal clue/i]);
});

await miniGame("/mini-games/hangman", "Hangman", async () => {
  const letters = "etaoinsrhldcumfpgwybvkxjqz'-".split("");
  for (const ch of letters) {
    const btn = page.getByRole("button", { name: new RegExp(`^${ch.replace(/[-']/g, "\\$&")}$`, "i") }).first();
    if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 1500 }).catch(() => {});
    else await page.keyboard.press(ch).catch(() => {});
    await page.waitForTimeout(60);
  }
});

await miniGame("/mini-games/higher-lower", "Higher or Lower", async () => {
  for (let i = 0; i < 25; i++) {
    const t = await tapFirst(page, [i % 2 ? /^Higher$/i : /^Lower$/i, /Next pick/i, /Play again|New game|Try again|Restart/i]);
    if (!t) break;
    await page.waitForTimeout(250);
  }
});

await miniGame("/mini-games/quiz", "Quiz", async () => {
  for (let i = 0; i < 20; i++) {
    const options = page.locator("main button").filter({ hasNotText: /Walk|Keep|Back|Mini Games|Lifeline|50|Ask|Phone/i });
    const n = await options.count();
    if (!n) break;
    await options.nth(i % Math.max(1, Math.min(4, n))).click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
    await tapFirst(page, [/Next question|Continue|Next/i]);
    await page.waitForTimeout(300);
  }
});

/* ------------------------------------------------------------ 4) corrupt every saved key */
currentWhere = "corrupt storage";
const keys = await page.evaluate(() => Object.keys(localStorage));
await page.evaluate((ks) => {
  for (const k of ks) localStorage.setItem(k, k.includes("muted") ? "maybe" : "{{not json");
}, keys);
for (const route of ROUTES) {
  currentWhere = `${route} with corrupted storage (${keys.length} keys)`;
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await settle(page, 900);
  const crashed = await page.getByText(/Something went wrong|Application error|career hit a problem/i).first().isVisible().catch(() => false);
  if (crashed) problems.push(`[${currentWhere}] page shows a crash screen`);
}
note(`Corrupted all ${keys.length} saved keys and revisited every route`);

// Wrong-typed but valid JSON in every key.
await page.evaluate((ks) => {
  for (const k of ks) localStorage.setItem(k, JSON.stringify({ wins: "lots", games: null, balance: -1, version: 999, items: "x" }));
}, keys);
for (const route of ROUTES) {
  currentWhere = `${route} with wrong-shaped storage`;
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await settle(page, 900);
  const crashed = await page.getByText(/Something went wrong|Application error|career hit a problem/i).first().isVisible().catch(() => false);
  if (crashed) problems.push(`[${currentWhere}] page shows a crash screen`);
}
note("Wrong-shaped JSON in every key, revisited every route");

await browser.close();
const unique = [...new Set(problems)];
if (process.env.CI) {
  const { writeFileSync } = await import("node:fs");
  mkdirSync("e2e-shots", { recursive: true });
  writeFileSync("e2e-shots/site-report.txt", `${unique.length} problem(s)\n${unique.join("\n")}\n\nChecks:\n${notes.join("\n")}\n`);
}
if (unique.length) {
  console.error(`\n${unique.length} problem(s):\n- ${unique.join("\n- ")}`);
  if (process.env.CI) console.log(`::error title=Site e2e (${unique.length} problems)::${unique.slice(0, 40).join("%0A").slice(0, 3800)}`);
  process.exit(1);
}
console.log(`\nSITE E2E PASSED: ${notes.length} checks`);
if (process.env.CI) console.log(`::notice title=Site e2e passed::${notes.join("%0A")}`);
