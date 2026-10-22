/**
 * Adversarial e2e for Manager Mode: tries to break it like an impatient player would.
 * - garbage / half-valid saves in localStorage
 * - rapid repeated taps on Play
 * - a Championship season driven only by "Quick sim" / "Continue"
 * - two tabs open on the same career
 * - 320px-wide screens: no sideways scrolling on any screen
 * Fails on any page error or unexpected HTTP / console error.
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const SAVE_KEY = "27-0-career-v2-save";
const errors = [];
const steps = [];
const step = (m) => {
  steps.push(m);
  console.log(`✓ ${m}`);
};
const IGNORED = [/supabase/i, /Failed to fetch/i, /ERR_NAME_NOT_RESOLVED/i, /fetch failed/i, /\[career-leaderboard\]/, /\[career\] cloud/, /Load failed/i, /net::ERR_/i, /_vercel\/insights/, /Failed to load resource/i];
const IGNORED_URLS = [/\/_vercel\//, /supabase/i, /favicon/i, /\/sounds\/[\w-]+\.mp3$/];
const timeout = 20_000;

const browser = await chromium.launch();

async function newPage(context) {
  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !IGNORED.some((re) => re.test(msg.text()))) errors.push(`console: ${msg.text()}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && !IGNORED_URLS.some((re) => re.test(res.url()))) errors.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  return page;
}

async function noSidewaysScroll(page, where) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (sw > cw + 1) errors.push(`${where}: page scrolls sideways (${sw}px content in ${cw}px screen)`);
}

async function startCareer(page, division, index = 0) {
  await page.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Pick your club" }).waitFor({ timeout });
  if (division === "super-league") await page.getByRole("tab", { name: /Super League/ }).click();
  const clubs = page.getByRole("list", { name: "Clubs" }).getByRole("button");
  await clubs.nth(index).click();
  await page.getByRole("button", { name: /Take charge of/ }).click();
  // Chaos runs skip the first-save walkthrough.
  await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout }).catch(() => {});
  await page.getByRole("button", { name: /Play match|Continue/ }).first().waitFor({ timeout });
}

try {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
  const page = await newPage(context);

  // 1) Garbage and half-valid saves must fall back to the club picker, not crash.
  for (const [label, value] of [
    ["not JSON", "{{{nope"],
    ["wrong shape", JSON.stringify({ version: 1, hello: "world" })],
    ["missing tables", JSON.stringify({ version: 1, seed: "x", userClubId: "a", clubs: { a: { squad: [] } }, players: {}, calendar: [], matchdayIndex: 0, phase: "season" })],
    ["future version", JSON.stringify({ version: 99 })],
  ]) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, value]);
    await page.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Pick your club" }).waitFor({ timeout });
  }
  step("Corrupted saves fall back to the club picker");
  await noSidewaysScroll(page, "picker @320");

  // 2) Rapid taps on Play.
  await startCareer(page, "super-league", 13);
  await noSidewaysScroll(page, "hub @320");
  const play = page.getByRole("button", { name: /^(Quick sim|Continue|Shut the window)$/ }).first();
  for (let i = 0; i < 5; i++) await play.click({ force: true, noWaitAfter: true }).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByText(/Last result/).first().waitFor({ timeout });
  step("Five rapid taps on Quick sim handled");

  for (const tab of ["Team", "Table", "Club"]) {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(250);
    await noSidewaysScroll(page, `${tab} tab @320`);
  }
  await page.getByRole("tab", { name: "Match" }).click();
  step("All hub tabs fit a 320px screen");

  // 3) Two tabs on one career: play in A, B must follow.
  const pageB = await newPage(context);
  await pageB.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
  await pageB.getByRole("button", { name: /Play match|Continue/ }).first().waitFor({ timeout });
  const headerB1 = await pageB.locator("header", { hasText: /Super League|Championship/ }).first().innerText();
  await page.getByRole("button", { name: /^(Quick sim|Continue|Shut the window)$/ }).first().click();
  await page.waitForTimeout(600);
  await pageB.waitForTimeout(600);
  const headerB2 = await pageB.locator("header", { hasText: /Super League|Championship/ }).first().innerText();
  if (headerB1 === headerB2) errors.push("two tabs: tab B did not pick up progress from tab A");
  await pageB.close();
  step("Second tab follows the first");

  // 4) Championship career driven only by big-game sims / Continue, through the no-game weeks.
  await page.getByRole("tab", { name: "Club" }).click();
  await page.getByRole("button", { name: "Start a new career" }).click();
  await page.getByRole("button", { name: "End career" }).click();
  await startCareer(page, "championship", 21);
  let guard = 0;
  while (guard++ < 80) {
    if (await page.getByText(/season review/i).first().isVisible().catch(() => false)) break;
    const next = page.getByRole("button", { name: /^(Quick sim|Continue|Shut the window)$/ }).first();
    if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
    await page.waitForTimeout(120);
  }
  await page.getByText(/season review/i).first().waitFor({ timeout: 30_000 });
  await noSidewaysScroll(page, "review @320");
  step(`Championship season via Quick sim (${guard} taps)`);

  // Reload on the review screen must not re-bank Legacy.
  const lpBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("27-0-career-v2-legacy") || "{}").lifetimeLegacyPoints ?? 0);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(/season review/i).first().waitFor({ timeout });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(/season review/i).first().waitFor({ timeout });
  const lpAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("27-0-career-v2-legacy") || "{}").lifetimeLegacyPoints ?? 0);
  if (lpAfter !== lpBefore) errors.push(`reloading the review re-banked Legacy (${lpBefore} → ${lpAfter})`);
  step("Reloading the review screen doesn't re-award Legacy");

  await page.getByRole("button", { name: "Go to transfers" }).click();
  await page.getByRole("heading", { name: "Build your squad" }).waitFor({ timeout });
  await noSidewaysScroll(page, "transfers @320");
  // Try to sell the whole squad: must stop at the minimum without errors.
  await page.getByRole("tab", { name: "Sell" }).click();
  for (let i = 0; i < 40; i++) {
    const sell = page.getByRole("button", { name: /^Sell £/ }).first();
    if (!(await sell.isEnabled().catch(() => false))) break;
    await sell.click();
  }
  const squadSize = await page.evaluate((k) => {
    const save = JSON.parse(localStorage.getItem(k) || "null");
    return save ? save.clubs[save.userClubId].squad.length : -1;
  }, SAVE_KEY);
  if (squadSize !== 20) errors.push(`selling everything left the squad at ${squadSize} (expected 20)`);
  step("Can't sell below the 20-man minimum");
  await page.getByRole("button", { name: /Start (the )?\d{4} season/ }).click();
  await page.getByRole("button", { name: /Play match|Continue/ }).first().waitFor({ timeout });
  step("Next season starts after a fire sale");

  await context.close();
} catch (err) {
  errors.push(`step failed after [${steps.at(-1) ?? "start"}]: ${err instanceof Error ? err.message : String(err)}`);
}

await browser.close();
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n- ${[...new Set(errors)].join("\n- ")}`);
  process.exit(1);
}
console.log(`\nCHAOS E2E PASSED: ${steps.length} steps`);
if (process.env.CI) console.log(`::notice title=Manager Mode chaos e2e passed (${steps.length} steps)::${steps.join("%0A")}`);
