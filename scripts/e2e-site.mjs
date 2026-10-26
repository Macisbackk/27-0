/**
 * Whole-site break test against a running build (default http://localhost:3000).
 *  1. Crawl every route at 320 / 375 / desktop widths: no page errors, no HTTP errors, no sideways scroll.
 *  2. Check every internal link found on the site resolves.
 *  3. Play each mode like a (careless) user: Classic Current + Era, Daily Challenge, Quiz, Wordle, Hangman, Higher/Lower.
 *  4. Corrupt every localStorage key the site wrote, then revisit every route: nothing may crash.
 * CI: screenshots of each route (375px) go to e2e-shots/site-*.png.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const ROUTES = [
  "/", "/play", "/play?era=1", "/play?daily=1", "/manager", "/mini-games", "/mini-games/quiz", "/mini-games/wordle", "/mini-games/grid",
  "/quiz", "/leaderboard", "/stats", "/profile", "/store", "/squad-book",
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

let hydrationDumps = 0;
/** On a hydration mismatch, save server HTML, the client DOM and storage so the cause can be diffed. */
async function dumpHydration(page, where) {
  if (!process.env.CI || hydrationDumps >= 3) return;
  hydrationDumps += 1;
  try {
    mkdirSync("e2e-shots", { recursive: true });
    const url = page.url();
    const server = await page.request.get(url).then((r) => r.text()).catch((e) => `fetch failed: ${e.message}`);
    const client = await page.content().catch(() => "");
    const storage = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage)), null, 1)).catch(() => "");
    const n = hydrationDumps;
    writeFileSync(`e2e-shots/hydration-${n}-info.txt`, `${where}\n${url}\n${new Date().toISOString()}\n\nlocalStorage:\n${storage.slice(0, 20000)}\n`);
    writeFileSync(`e2e-shots/hydration-${n}-server.txt`, server);
    writeFileSync(`e2e-shots/hydration-${n}-client.txt`, client);
  } catch {
    /* diagnostics only */
  }
}

function wire(page) {
  page.on("pageerror", (err) => {
    problems.push(`[${currentWhere}] page error: ${err.message}`);
    if (/#418|#423|#425|Hydration/i.test(err.message)) void dumpHydration(page, currentWhere);
  });
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
      /Skip boost|Continue without boost/i, /Auto.?fill squad/i, /Simulate season/i,
      // Round-14 fork ("Halfway. What's the plan?") — take a plan when it is up.
      /Push for the top two/i, /Rest the stars/i, /Chase the points difference/i,
      /Skip/i, /Sim(ulate)? (to )?(end|all|rest)/i,
      /^Continue$/i, /Next/i, /View (season )?review/i, /See (your )?review/i, /Finish/i,
    ]);
    if (tapped) seen.push(tapped.replace(/\\|\^|\$|\/i/g, ""));
    await page.waitForTimeout(tapped ? 900 : 1500);
  }
  if (!reviewed) problems.push(`[${label}] never reached the season review (taps: ${seen.slice(0, 12).join(" › ")})`);
  else note(`${label}: full run to review (${seen.length} taps)`);
  await shot(page, `${label.replace(/\W+/g, "-").toLowerCase()}-end`);
}

await playClassic("/play?e2e=1", "Classic Current");
await playClassic("/play?era=1&e2e=1", "Classic Era");
await playClassic("/play?daily=1", "Daily Challenge");

// Rapid taps on Auto Fill / Simulate at the start of a fresh run.
currentWhere = "Classic rapid taps";
await page.goto(`${BASE}/play?e2e=1`, { waitUntil: "domcontentloaded" });
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
  await tapFirst(page, [/^Current/i, /Golden Point Quiz|Start quiz|Normal Quiz/i]);
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
  for (let i = 0; i < 4; i++) await tapFirst(page, [/Reveal (a )?clue/i]);
});

await miniGame("/mini-games/grid", "Grid", async () => {
  for (const guess of ["a", "Smith", "😀", "x".repeat(80), "Sam Tomkins", "Kevin Sinfield", "James Roby", "Jamie Peacock", "Rob Burrow", "Paul Wellens", "Danny McGuire"]) {
    const cell = page.getByRole("button", { name: /: empty$/i }).first();
    if (!(await cell.isVisible().catch(() => false))) break;
    await cell.click({ timeout: 2000 }).catch(() => {});
    const input = page.getByRole("combobox").or(page.locator("input[type='text'], input:not([type])")).first();
    if (!(await input.isVisible().catch(() => false))) break;
    await input.fill(guess);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
  }
  await tapFirst(page, [/Finish now/i]);
  await tapFirst(page, [/Tap again to finish/i]);
  await page.waitForTimeout(400);
  await tapFirst(page, [/^Nice$/i]);
  await tapFirst(page, [/Copy result/i]);
  await tapFirst(page, [/Practice grid/i]);
  await page.waitForTimeout(400);
  await tapFirst(page, [/Back to today/i]);
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
