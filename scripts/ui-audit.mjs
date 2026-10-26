/**
 * UI audit: full-page screenshots of every screen and the main in-flow states at phone width
 * (375px), plus key pages at desktop width. Not a pass/fail test — the pictures are for review.
 * CI publishes e2e-shots/ui-*.png to the ci-shots/pr-<n> branch.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
mkdirSync("e2e-shots", { recursive: true });
const browser = await chromium.launch();
const log = [];
let n = 0;

async function shot(page, name, { full = true } = {}) {
  n += 1;
  const file = `e2e-shots/ui-${String(n).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage: full, scale: "css" }).catch((e) => log.push(`shot ${name} failed: ${e.message}`));
  const { sw, cw, h } = await page
    .evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight }))
    .catch(() => ({ sw: 0, cw: 0, h: 0 }));
  log.push(`${file} h=${h}${sw > cw + 1 ? ` SIDEWAYS ${sw}>${cw}` : ""}`);
}

async function settle(page, ms = 1200) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

async function tap(page, patterns, scope) {
  const root = scope ?? page;
  for (const re of patterns) {
    const btn = root.getByRole("button", { name: re }).first();
    if ((await btn.isVisible().catch(() => false)) && (await btn.isEnabled().catch(() => false))) {
      await btn.click({ timeout: 4000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function go(page, route, ms) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await settle(page, ms);
}

/* ---------------------------------------------------------------- phone */
const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await phone.newPage();

for (const [route, name] of [
  ["/", "home"],
  ["/manager", "manager"],
  ["/mini-games", "mini-games"],
  ["/squad-book", "squad-book"],
  ["/records", "records"],
  ["/leaderboard", "leaderboard"],
  ["/profile", "profile"],
  ["/store", "store"],
  ["/showcase", "showcase"],
  ["/login", "login"],
  ["/settings", "settings"],
]) {
  await go(page, route);
  await shot(page, name);
}

// Leaderboard + store tabs.
await go(page, "/leaderboard");
for (const tab of await page.getByRole("tab").all().catch(() => [])) {
  const label = (await tab.innerText().catch(() => "")).trim().slice(0, 20);
  if (!label) continue;
  await tab.click().catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, `leaderboard-tab-${label.replace(/\W+/g, "-").toLowerCase()}`, { full: false });
}
await go(page, "/store");
for (const tab of await page.getByRole("tab").all().catch(() => [])) {
  const label = (await tab.innerText().catch(() => "")).trim().slice(0, 20);
  if (!label) continue;
  await tab.click().catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, `store-tab-${label.replace(/\W+/g, "-").toLowerCase()}`, { full: false });
}

// Classic: chooser → pitch → spin → choices → sign → autofill → sim → review → play-offs.
await go(page, "/play?e2e=1", 1500);
await shot(page, "classic-start", { full: false });
await tap(page, [/Skip boost|Continue without boost/i]);
await page.waitForTimeout(800);
await shot(page, "classic-pitch");
const slot = page.locator("div.absolute.z-10 > button").first();
if (await slot.isVisible().catch(() => false)) {
  await slot.click().catch(() => {});
  await page.waitForTimeout(700);
  await shot(page, "classic-spinning", { full: false });
  await page.getByRole("button", { name: /^Sign / }).first().waitFor({ timeout: 12_000 }).catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, "classic-choices");
  await page.getByRole("button", { name: /^Sign / }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await tap(page, [/Confirm Placement/i]);
  await page.waitForTimeout(900);
  await shot(page, "classic-after-sign");
}
await tap(page, [/Auto.?fill squad/i]);
await page.waitForTimeout(1200);
await shot(page, "classic-full-squad");
await tap(page, [/Kick off the season|Simulate Season/i]);
await page.waitForTimeout(2500);
await shot(page, "classic-simulating", { full: false });
for (let i = 0; i < 20; i++) {
  const text = await page.locator("main").innerText().catch(() => "");
  if (/Regular Season Record/i.test(text)) break;
  await tap(page, [/Push for the top two/i, /Rest the stars/i, /Chase the points difference/i, /Skip to full time/i, /^Continue$/i, /View (season )?review/i]);
  await page.waitForTimeout(800);
}
await settle(page, 800);
await shot(page, "classic-review");
if (await tap(page, [/play-?offs/i, /Continue to/i])) {
  await settle(page, 1000);
  await shot(page, "classic-playoffs");
  for (let i = 0; i < 12; i++) {
    if (!(await tap(page, [/Play (the )?(next )?match/i, /Simulate/i, /Sim /i, /^Continue$/i, /Next/i]))) break;
    await page.waitForTimeout(900);
  }
  await settle(page, 800);
  await shot(page, "classic-playoffs-end");
}

await go(page, "/play?era=1&e2e=1", 1500);
await tap(page, [/Skip boost|Continue without boost/i]);
await page.waitForTimeout(800);
await shot(page, "era-pitch", { full: false });
await go(page, "/play?daily=1", 1500);
await shot(page, "daily-pitch", { full: false });

await go(page, "/profile");
await shot(page, "profile-stats-after-a-run");

// Quiz.
await go(page, "/mini-games/quiz", 1200);
await shot(page, "quiz-start");
await tap(page, [/Normal Quiz/i, /Golden Point Quiz/i, /^Play/i, /Start/i]);
await page.waitForTimeout(1000);
await shot(page, "quiz-question");
const option = page.locator("main button").filter({ hasNotText: /Walk|Keep|Back|Mini Games|Lifeline|50|Ask|Phone|Change/i }).first();
await option.click().catch(() => {});
await page.waitForTimeout(400);
await tap(page, [/Final answer|Lock/i]);
await page.waitForTimeout(1500);
await shot(page, "quiz-answered");

// Wordle / Hangman / Higher-Lower.
for (const [route, name] of [
  ["/mini-games/wordle", "wordle"],
]) {
  await go(page, route, 1200);
  await shot(page, `${name}-start`);
  await tap(page, [/^Current/i]);
  await page.waitForTimeout(900);
  if (name === "wordle") {
    const input = page.getByRole("combobox").or(page.locator("input[type='text'], input:not([type])")).first();
    await input.fill("Sam").catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, "wordle-autocomplete", { full: false });
    await page.keyboard.press("Enter").catch(() => {});
    await page.waitForTimeout(800);
  }
  if (name === "hangman") for (const ch of "eaino") await page.keyboard.press(ch).catch(() => {});
  if (name === "higher-lower") {
    await tap(page, [/^Higher$/i]);
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(500);
  await shot(page, `${name}-playing`);
}

// Rugby League Grid: today's grid, a selected square with suggestions, then one guess in.
await go(page, "/mini-games/grid", 1500);
await shot(page, "grid-start");
await tap(page, [/: empty$/i]);
await page.waitForTimeout(500);
{
  const input = page.getByRole("combobox").or(page.locator("input[type='text'], input:not([type])")).first();
  await input.fill("Sam").catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, "grid-autocomplete", { full: false });
  await page.getByRole("option").first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
}
await shot(page, "grid-playing");

// Store cosmetics in use (seeded straight into storage).
await page.evaluate(() => {
  localStorage.setItem(
    "27-0-cosmetics-store",
    JSON.stringify({
      owned: ["kit-designer", "pitch-floodlit", "title-deadline-dealer", "frame-foil", "mode-ball-knower"],
      purchaseIds: [],
      equipped: { pitch: "pitch-floodlit", title: "title-deadline-dealer", frame: "frame-foil" },
      kit: { pattern: "v", body: "#0A2540", trim: "#FDB913", enabled: true },
    })
  );
});
await go(page, "/store", 1000);
await page.getByRole("tab", { name: "Kit & pitch" }).click().catch(() => {});
await page.waitForTimeout(600);
await shot(page, "store-kit-and-pitch");
await go(page, "/play?bk=1&e2e=1", 1500);
await tap(page, [/Skip boost|Continue without boost/i]);
await page.waitForTimeout(600);
await tap(page, [/Auto.?fill squad/i]);
await page.waitForTimeout(1500);
await shot(page, "cosmetics-ball-knower-kit-floodlit", { full: false });
await go(page, "/store", 1000);
await page.getByRole("tab", { name: "Frames" }).click().catch(() => {});
await page.waitForTimeout(600);
await shot(page, "cosmetics-leaderboard-frames", { full: false });
await go(page, "/profile", 1000);
await shot(page, "cosmetics-title", { full: false });
await page.evaluate(() => localStorage.removeItem("27-0-cosmetics-store"));

// Manager Mode picker.
await go(page, "/manager", 1200);
await shot(page, "manager-picker");
await phone.close();

/* ---------------------------------------------------------------- desktop */
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const dp = await desk.newPage();
for (const [route, name] of [
  ["/", "desktop-home"],
  ["/play", "desktop-play"],
  ["/mini-games", "desktop-mini-games"],
  ["/leaderboard", "desktop-leaderboard"],
  ["/store", "desktop-store"],
  ["/manager", "desktop-manager"],
]) {
  await go(dp, route);
  if (name === "desktop-play") await tap(dp, [/Skip boost|Continue without boost/i]);
  await dp.waitForTimeout(600);
  await shot(dp, name, { full: false });
}
await desk.close();
await browser.close();

const { writeFileSync } = await import("node:fs");
writeFileSync("e2e-shots/ui-audit.txt", log.join("\n") + "\n");
console.log(log.join("\n"));
if (process.env.CI) console.log(`::notice title=UI audit (${n} screenshots)::${log.join("%0A").slice(0, 3800)}`);
