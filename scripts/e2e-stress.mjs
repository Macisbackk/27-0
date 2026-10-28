/**
 * Stress test for everything added since the last break test (v1.01–v1.04):
 * Store cosmetics, Ball Knower, full-squad Classic picker, tap-to-skip spin, season sim,
 * leaderboard frames, sign-up/forgot password, Manager walkthrough, pre-season friendlies,
 * Deadline Day pause, mid-season market. Plays like an impatient, curious player: double taps,
 * rapid repeats, reloads mid-flow, odd URLs, tiny screens, tampered storage.
 * Fails on any page error, console error, unexpected HTTP error, sideways scroll or broken rule.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const SAVE_KEY = "27-0-career-v2-save";
const FUNDS_KEY = "27-0-club-funds";
const COSMETICS_KEY = "27-0-cosmetics-store";
const timeout = 20_000;
const errors = [];
const steps = [];
const step = (m) => {
  steps.push(m);
  console.log(`✓ ${m}`);
};
const IGNORED = [/supabase/i, /Failed to fetch/i, /ERR_NAME_NOT_RESOLVED/i, /fetch failed/i, /\[career-leaderboard\]/, /\[career\] cloud/, /Load failed/i, /net::ERR_/i, /_vercel\/insights/, /Failed to load resource/i];
const IGNORED_URLS = [/\/_vercel\//, /supabase/i, /favicon/i, /\/sounds\/[\w-]+\.mp3$/];
mkdirSync("e2e-shots", { recursive: true });

const browser = await chromium.launch();
let where = "start";

async function newPage(context) {
  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push(`[${where}] pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !IGNORED.some((re) => re.test(msg.text()))) errors.push(`[${where}] console: ${msg.text().slice(0, 300)}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && !IGNORED_URLS.some((re) => re.test(res.url()))) errors.push(`[${where}] HTTP ${res.status()}: ${res.url()}`);
  });
  return page;
}
async function noSideways(page, label) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (sw > cw + 1) errors.push(`${label}: page scrolls sideways (${sw}px in ${cw}px)`);
}
const fail = (m) => errors.push(`[${where}] ${m}`);
const shot = (page, name) => page.screenshot({ path: `e2e-shots/stress-${name}.png`, scale: "css" }).catch(() => {});
const funds = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}").balance ?? 0, FUNDS_KEY);
const setFunds = (page, balance) =>
  page.evaluate(([k, b]) => localStorage.setItem(k, JSON.stringify({ balance: b, totalEarned: b, paidRunIds: ["starter-grant"] })), [FUNDS_KEY, balance]);

try {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
  const page = await newPage(context);

  // ── 1. Store: can't buy what you can't afford; double-tap buys once; equip spam is stable.
  where = "store";
  await page.goto(`${BASE}/store`, { waitUntil: "networkidle" });
  await setFunds(page, 1_000_000);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Modes" }).click();
  const bkBuy = page.getByRole("button", { name: /£6(\.0)?m/ }).first();
  if (await bkBuy.isEnabled().catch(() => false)) {
    await bkBuy.click().catch(() => {});
    if ((await funds(page)) !== 1_000_000) fail("bought Ball Knower without enough Club Funds");
  }
  step("Store: can't buy Ball Knower (£6m) with £1m");

  await setFunds(page, 12_000_000);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Frames" }).click();
  const before = await funds(page);
  const buyGold = page.getByRole("button", { name: /£3(\.0)?m/ }).first();
  await buyGold.dblclick().catch(() => {});
  await page.waitForTimeout(400);
  const spent = before - (await funds(page));
  if (spent !== 3_000_000) fail(`double-tapping a £3m frame spent ${spent}`);
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: /^(Use|On)$/ }).first().click().catch(() => {});
  const equipped = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}").equipped?.frame ?? null, COSMETICS_KEY);
  if (equipped !== null && equipped !== "frame-gold") fail(`frame equip spam left ${equipped}`);
  await noSideways(page, "store frames @320");
  await shot(page, "store-frames");
  step("Store: double-tap buys once, equip spam stays consistent");

  // Titles + kit designer with tampered colours.
  await page.getByRole("tab", { name: "Titles" }).click();
  await page.getByRole("button", { name: /£1\.5m/ }).first().click().catch(() => {});
  await page.getByRole("tab", { name: "Kit", exact: true }).click();
  await page.getByRole("button", { name: /£4\.5m/ }).first().click().catch(() => {});
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k) || "{}");
    s.kit = { pattern: "<script>", body: "javascript:alert(1)", trim: "#zzzzzz", enabled: true };
    localStorage.setItem(k, JSON.stringify(s));
  }, COSMETICS_KEY);
  await page.reload({ waitUntil: "networkidle" });
  await noSideways(page, "store kit @320");
  step("Store: titles, kit designer, tampered kit colours load safely");

  // ── 2. Ball Knower URL without owning it → back to the Store, never a hidden-rating run for free.
  where = "ball-knower";
  await page.evaluate((k) => localStorage.removeItem(k), COSMETICS_KEY);
  await page.goto(`${BASE}/play?bk=1`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/store/, { timeout }).catch(() => fail("/play?bk=1 without owning Ball Knower didn't go to the Store"));
  step("Ball Knower is locked without buying it");

  // ── 3. Classic: tap-to-skip spin, picker double-tap signs once, respin spam, auto-fill, season sim card stays put.
  where = "classic";
  await page.goto(`${BASE}/play?e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Skip boost|Continue without boost/i }).first().click({ timeout: 4000 }).catch(() => {});
  // v1.40: Classic has one Spin button (the reel spins positions); team-sheet slots aren't spin buttons.
  if (await page.getByRole("button", { name: /: empty — tap to spin$/ }).count()) {
    fail("Classic team sheet still has tap-to-spin slots");
  }
  for (let round = 0; round < 3; round++) {
    await page.getByRole("button", { name: /^Spin$/ }).click({ timeout });
    await page.waitForTimeout(300);
    await page.getByRole("dialog", { name: "Recruitment spin" }).click({ timeout: 3000 }).catch(() => {}); // tap to skip
    // v1.42: the landed position waits for "Respin" or "See players".
    const seePlayers = page.getByRole("button", { name: "See players" });
    await seePlayers.waitFor({ timeout });
    if (round === 1) {
      const posRespin = page.getByRole("dialog", { name: "Recruitment spin" }).getByRole("button", { name: /^Respin/ });
      if (!(await posRespin.isEnabled())) fail("position Respin disabled with respins left");
      await posRespin.click({ timeout });
      await page.waitForTimeout(300);
      await page.getByRole("dialog", { name: "Recruitment spin" }).click({ timeout: 3000 }).catch(() => {});
      await seePlayers.waitFor({ timeout });
    }
    await seePlayers.click({ timeout });
    const sign = page.getByRole("button", { name: /^Sign / }).first();
    await sign.waitFor({ timeout });
    if (round === 0) {
      await shot(page, "classic-picker");
      // v1.40 club choice: one card from each of up to three different clubs.
      const clubs = await page
        .locator(".slot-picker__row[data-club]")
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-club")));
      if (clubs.length < 2) fail(`Classic picker offered ${clubs.length} club(s), expected a choice of clubs`);
      if (new Set(clubs).size !== clubs.length) fail(`Classic picker repeated a club: ${clubs.join(", ")}`);
      const box = await page.locator(".slot-picker__card").boundingBox();
      if (box && box.y + box.height > 640 + 2) fail(`picker is taller than a 320×640 screen (${Math.round(box.y + box.height)}px)`);
      const respin = page.getByRole("button", { name: /^Respin/ });
      for (let i = 0; i < 4; i++) await respin.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(400);
      await page.getByRole("dialog", { name: "Recruitment spin" }).click({ timeout: 3000 }).catch(() => {});
      await page.getByRole("button", { name: "See players" }).click({ timeout }).catch(() => {});
    }
    await page.getByRole("button", { name: /^Sign / }).first().dblclick({ timeout });
    await page.getByRole("button", { name: /Confirm Placement/i }).first().click({ timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  const filled = await page.locator('[aria-label*="rated"]').count();
  if (filled !== 3) fail(`after 3 signings the team sheet shows ${filled} players`);
  await noSideways(page, "classic @320");
  step("Classic: skip spins, respin spam, double-tap Sign signs exactly once");

  await page.getByRole("button", { name: /Auto.?fill squad/i }).click({ timeout });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Kick off the season|Simulate season/i }).first().click({ timeout });
  await page.getByText("Your season").waitFor({ timeout });
  const heights = [];
  // Sample while the season is still running (the final summary is allowed to grow it).
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(400);
    if (await page.getByText("Full time on the season").isVisible().catch(() => false)) break;
    const h = await page.evaluate(() => document.querySelector(".rounded-\\[16px\\].bg-pitch-800")?.getBoundingClientRect().height ?? 0);
    heights.push(Math.round(h));
  }
  if (Math.max(...heights) - Math.min(...heights) > 40) fail(`season sim card grew while simulating: ${heights.join(" → ")}`);
  await shot(page, "season-sim");
  step("Season sim card keeps its size as results land");

  // ── 3b. Era: one club per spin, and no chemistry shown (it has no effect there, v1.40).
  where = "era";
  await page.goto(`${BASE}/play?era=1&e2e=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Skip boost|Continue without boost/i }).first().click({ timeout: 4000 }).catch(() => {});
  for (let round = 0; round < 2; round++) {
    await page.getByRole("button", { name: /: empty — tap to spin$/ }).first().click({ timeout });
    await page.waitForTimeout(300);
    await page.getByRole("dialog", { name: "Recruitment spin" }).click({ timeout: 3000 }).catch(() => {});
    await page.getByRole("button", { name: /^Sign / }).first().waitFor({ timeout });
    const eraClubs = await page
      .locator(".slot-picker__row[data-club]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-club")));
    if (new Set(eraClubs).size > 1) fail(`Era picker mixed clubs: ${eraClubs.join(", ")}`);
    if (await page.locator(".slot-picker__card").getByText(/\+\d\.\d link|chemistry/i).count()) fail("Era picker shows chemistry");
    await page.getByRole("button", { name: /^Sign / }).first().click({ timeout });
    await page.waitForTimeout(500);
  }
  if (/Chemistry/i.test(await page.locator(".matchday-scoreboard").innerText().catch(() => ""))) {
    fail("Era scoreboard shows chemistry");
  }
  step("Era: one club per spin, no chemistry shown");

  // ── 4. Login page: forgot password with no email, then a bad email.
  where = "login";
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Forgot password?" }).click({ timeout });
  await page.getByText(/Enter your email (above|first)/).waitFor({ timeout: 3000 }).catch(() => fail("Forgot password with no email gave no guidance"));
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Create account" }).last().click();
  await noSideways(page, "login @320");
  step("Login: Forgot password guards an empty email; empty sign-up handled");

  // ── 5. Leaderboard + profile with a frame equipped.
  where = "leaderboard";
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ owned: ["frame-foil", "title-ball-knower"], purchaseIds: [], equipped: { pitch: null, title: "title-ball-knower", frame: "frame-foil" }, kit: { pattern: "hoops", body: "#1d4ed8", trim: "#facc15", enabled: false } })), COSMETICS_KEY);
  await page.goto(`${BASE}/leaderboard`, { waitUntil: "networkidle" });
  await noSideways(page, "leaderboard @320");
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  if (!(await page.locator(".lb-row--foil").count())) fail("equipped foil frame not shown on the profile card");
  await shot(page, "profile-frame");
  step("Frames: leaderboard and profile render with a frame equipped");

  // ── 6. Manager Mode: walkthrough, reload mid-walkthrough, friendlies double-tap, Deadline Day pause.
  where = "manager";
  await page.evaluate((k) => localStorage.removeItem(k), SAVE_KEY);
  await page.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
  await page.getByRole("list", { name: "Clubs" }).getByRole("button").first().click({ timeout });
  await page.getByRole("button", { name: /Take charge of/ }).click();
  const tour = page.getByRole("dialog", { name: "Manager Mode walkthrough" });
  await tour.waitFor({ timeout });
  await tour.getByRole("button", { name: "Next" }).click();
  await page.reload({ waitUntil: "networkidle" });
  await tour.waitFor({ timeout }).catch(() => fail("walkthrough vanished after a reload before finishing it"));
  await tour.getByRole("button", { name: "Skip" }).click();
  await page.reload({ waitUntil: "networkidle" });
  if (await tour.isVisible().catch(() => false)) fail("walkthrough came back after Skip + reload");
  step("Walkthrough survives a reload and stays gone after Skip");

  const pre = page.getByRole("region", { name: "Pre-season friendlies" });
  await pre.waitFor({ timeout });
  const opts = pre.getByRole("button", { pressed: false });
  for (let i = 0; i < 5; i++) await opts.first().click().catch(() => {}); // try to pick 5
  const pickedCount = await pre.getByRole("button", { pressed: true }).count();
  if (pickedCount > 2) fail(`picked ${pickedCount} friendlies (max 2)`);
  const budgetBefore = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}").budget, SAVE_KEY);
  await pre.getByRole("button", { name: /^Play / }).dblclick();
  await page.getByRole("region", { name: "Pre-season results" }).waitFor({ timeout });
  const save = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), SAVE_KEY);
  if ((save.preseason?.results?.length ?? 0) > 2) fail("friendlies played more than twice");
  const gained = save.budget - budgetBefore;
  if (gained > 90_000) fail(`friendlies paid ${gained} (double-tap paid twice?)`);
  await noSideways(page, "manager preseason @320");
  step("Friendlies: max two, double-tap plays once, paid once");
  // v1.29: the friendly results sit above Round 1; the double tap on Play must not kick it off.
  await page.getByRole("button", { name: "Play match" }).waitFor({ timeout });
  if ((await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}").matchdayIndex, SAVE_KEY)) !== 0) fail("double tap on Play friendlies played Round 1");
  step("Friendly results above Round 1 (double-tap safe)");

  // Drive to Deadline Day with Quick sim; nothing should get past it until the window is shut.
  let reached = false;
  for (let i = 0; i < 90 && !reached; i++) {
    if (await page.getByRole("button", { name: "Shut the window" }).first().isVisible().catch(() => false)) {
      reached = true;
      break;
    }
    const next = page.getByRole("button", { name: /^(Quick sim|Continue)$/ }).first();
    if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
    await page.waitForTimeout(100);
  }
  if (!reached) fail("never reached Deadline Day");
  const mdAt = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}").matchdayIndex, SAVE_KEY);
  await page.reload({ waitUntil: "networkidle" });
  if (await page.getByRole("button", { name: "Quick sim" }).isVisible().catch(() => false)) fail("Quick sim offered on Deadline Day after a reload");
  const mdAfter = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}").matchdayIndex, SAVE_KEY);
  if (mdAfter !== mdAt) fail("the season moved on during Deadline Day");
  await shot(page, "deadline-paused");
  await page.getByRole("button", { name: "Shut the window" }).first().dblclick();
  await page.getByRole("button", { name: /^(Quick sim|Continue)$/ }).first().waitFor({ timeout });
  step("Deadline Day pauses the season (survives reload) until the window is shut");

  await context.close();
} catch (err) {
  errors.push(`step failed after [${steps.at(-1) ?? "start"}]: ${err instanceof Error ? err.message : String(err)}`);
}

await browser.close();
if (errors.length) {
  const list = [...new Set(errors)];
  console.error(`\n${list.length} problem(s):\n- ${list.join("\n- ")}`);
  if (process.env.CI) console.log(`::error title=Stress test (${list.length} problems)::${list.slice(0, 30).join("%0A").slice(0, 3800)}`);
  process.exit(1);
}
console.log(`\nStress test passed (${steps.length} checks).`);
