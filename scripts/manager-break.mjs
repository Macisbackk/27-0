/**
 * Manager Mode UI break run: drives a whole season and summer on a 320px phone, trying to break
 * every stage — double taps, reloads mid-stage, back/forward, two tabs, sideways scroll, console
 * errors. Writes preview-shots/manager-break.txt (+ screenshots). Run against `next start` on :3000.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "preview-shots";
const SAVE_KEY = "27-0-career-v2-save";
fs.mkdirSync(OUT, { recursive: true });
const timeout = 15000;
const problems = [];
const steps = [];
const step = (m) => {
  steps.push(`✓ ${m}`);
  console.log(`✓ ${m}`);
};
const fail = (m) => {
  problems.push(m);
  console.log(`✗ ${m}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/Failed to load resource|favicon|supabase|net::ERR|_vercel\/insights/i.test(m.text())) consoleErrors.push(m.text().slice(0, 200));
});

let shotN = 0;
const shot = async (name) => {
  shotN++;
  await page.screenshot({ path: `${OUT}/mb-${String(shotN).padStart(2, "0")}-${name}.png`, fullPage: false }).catch(() => {});
};
const save = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), SAVE_KEY);
async function noSideways(where) {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  if (sw > cw + 1) fail(`${where}: page scrolls sideways (${sw}px in ${cw}px)`);
}
const btn = (name) => page.getByRole("button", { name }).first();
const visible = (loc) => loc.isVisible().catch(() => false);
async function reloadAndCheck(label, expectRegion) {
  const before = await save();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const after = await save();
  if (before?.matchdayIndex !== after?.matchdayIndex || before?.phase !== after?.phase) fail(`${label}: reload changed the save (${before?.phase}/${before?.matchdayIndex} → ${after?.phase}/${after?.matchdayIndex})`);
  if (expectRegion && !(await visible(page.getByRole("region", { name: expectRegion, exact: true })))) fail(`${label}: after a reload "${expectRegion}" is gone`);
}

/** Deadline Day's 12-hour clock: it counts down, pauses, skips, offers can be taken, sales name the buyer. */
async function deadlineChecks() {
  const clock = async () => (await save())?.deadline?.minutesLeft;
  const m0 = await clock();
  await page.waitForTimeout(4500);
  const m1 = await clock();
  if (!(m1 < m0)) fail(`Deadline Day clock didn't count down (${m0} → ${m1})`);
  await btn("Pause the clock").click();
  const m2 = await clock();
  await page.waitForTimeout(4500);
  if ((await clock()) !== m2) fail("pausing didn't stop the Deadline Day clock");
  await reloadAndCheck("Deadline Day (paused)", "Deadline Day");
  if ((await clock()) !== m2) fail("a reload moved the paused clock");
  await btn("Skip an hour").click();
  await page.waitForTimeout(300);
  if ((await clock()) !== m2 - 60) fail(`Skip an hour went ${m2} → ${await clock()}`);
  // Let it run until an offer lands (up to ~40s of real time), then pause and take it.
  await btn("Resume the clock").click();
  const accept = page.getByRole("region", { name: "Offers for your players" }).getByRole("button", { name: "Accept" }).first();
  for (let i = 0; i < 40 && !(await visible(accept)); i++) await page.waitForTimeout(1000);
  if (await visible(accept)) {
    await shot("deadline-offer");
    await btn("Pause the clock").click().catch(() => {});
    const s0 = await save();
    const c = s0.deadline;
    const mine = new Set(s0.clubs[s0.userClubId].squad);
    const offer = c.offers.find((o) => o.expiresAt < c.minutesLeft && mine.has(o.playerId));
    await accept.click();
    await page.waitForTimeout(400);
    const s1 = await save();
    if (offer) {
      if (!s1.clubs[offer.clubId].squad.includes(offer.playerId)) fail("accepted Deadline Day offer: the player didn't join the bidding club");
      if (s1.clubs[s1.userClubId].squad.includes(offer.playerId)) fail("accepted Deadline Day offer: the player is still yours");
      if (s1.budget !== s0.budget + offer.fee) fail("accepted Deadline Day offer: fee not paid");
    }
    step("Deadline Day: clock counts down, pauses (and stays paused after a reload), skips an hour, an offer was accepted");
    await btn("Resume the clock").click().catch(() => {});
  } else step("Deadline Day: clock counts down, pauses, skips an hour (no offer landed in 40s)");
  // A sale in the market says where the player went, and he's really there.
  await btn("Buy and sell").click();
  await page.getByRole("region", { name: "Deadline Day clock" }).waitFor({ timeout }).catch(() => fail("no Deadline Day clock in the market"));
  await noSideways("Deadline Day market");
  await page.getByRole("tab", { name: "Sell" }).click();
  const sell = page.getByRole("button", { name: /^Sell / }).first();
  if (await sell.isEnabled().catch(() => false)) {
    const before = await save();
    await sell.click();
    const msg = await page.getByRole("status").filter({ hasText: /joins|Sold|free agent/ }).first().innerText({ timeout: 5000 }).catch(() => "");
    const after = await save();
    const goneId = before.clubs[before.userClubId].squad.find((id) => !after.clubs[after.userClubId].squad.includes(id));
    const m = /^(.+) joins (.+) for .+\. They were (.+)\.$/.exec(msg);
    if (!m) fail(`sale message doesn't say where he went: "${msg}"`);
    else {
      const club = Object.values(after.clubs).find((c) => c.name === m[2]);
      if (!club || !club.squad.includes(goneId)) fail(`sale said ${m[1]} joined ${m[2]}, but he isn't there`);
    }
    await shot("deadline-sale");
    step(`Market sale: "${msg}"`);
  }
  await btn("Back to Deadline Day").click().catch(() => {});
  await page.waitForTimeout(300);
}

try {
  await page.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Pick your club" }).waitFor({ timeout });
  const tabs = await page.getByRole("tab").allInnerTexts();
  if (tabs.some((t) => /climb|win now/i.test(t))) fail(`league picker still says ${tabs.join(" / ")}`);
  await noSideways("picker");
  await page.getByRole("list", { name: "Clubs" }).getByRole("button").nth(3).click();
  await page.getByPlaceholder("Your name").fill("Breaker").catch(() => {});
  // Double tap Take charge: one career, not two.
  await btn(/Take charge of/).dblclick();
  await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout }).catch(() => {});
  step("Career started (double tap on Take charge)");

  // Pre-season.
  const pre = page.getByRole("region", { name: "Pre-season friendlies" });
  await pre.waitFor({ timeout });
  if (await visible(btn("Play match"))) fail("Round 1 visible during pre-season");
  await noSideways("pre-season");
  await reloadAndCheck("pre-season", "Pre-season friendlies");
  // v1.18: two friendlies come pre-picked; the full list is behind "Change".
  await pre.getByRole("button", { name: "Change" }).click();
  await pre.getByRole("button", { name: /^Play 2/ }).dblclick();
  await page.getByRole("region", { name: "Pre-season results" }).waitFor({ timeout });
  await reloadAndCheck("friendly results", "Pre-season results");
  await shot("preseason-results");
  // Hammer Start the season: it must only move one stage (to Round 1, not past it).
  for (let i = 0; i < 4; i++) await btn("Start the season").click({ force: true, noWaitAfter: true }).catch(() => {});
  await btn("Play match").waitFor({ timeout });
  if ((await save()).matchdayIndex !== 0) fail("hammering Start the season played a round");
  step("Pre-season → results → Round 1, each on its own; reloads keep the stage; double taps safe");

  // Back / forward from the hub.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.goBack({ waitUntil: "networkidle" });
  await btn("Play match").waitFor({ timeout }).catch(() => fail("back button lost the Manager Mode hub"));
  step("Back/forward keeps the hub");

  // Every tab fits at 320px.
  for (const t of ["Team", "Table", "Club", "Match"]) {
    await page.getByRole("tab", { name: t }).click();
    await page.waitForTimeout(250);
    await noSideways(`${t} tab`);
  }
  // Contract labels on the Team tab.
  await page.getByRole("tab", { name: "Team" }).click();
  const teamText = await page.locator("main").innerText();
  if (!/yrs|Final year/.test(teamText)) fail("Team tab shows no contract lengths");
  await shot("team-contracts");
  await page.getByRole("tab", { name: "Match" }).click();
  step("Hub tabs fit 320px; contracts on the Team tab");

  // Season: walk every stage, reloading and double-tapping at each one.
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    if (await visible(page.getByText(/season review/i).first())) break;
    if (await visible(page.getByRole("region", { name: "Deadline Day", exact: true }))) {
      if (!seen.has("deadline")) {
        seen.add("deadline");
        if (await visible(btn("Quick sim"))) fail("Quick sim offered on Deadline Day");
        if (await visible(btn("Play match"))) fail("next fixture shown on Deadline Day");
        await reloadAndCheck("Deadline Day", "Deadline Day");
        await noSideways("Deadline Day");
        await shot("deadline");
        await deadlineChecks();
      }
      const shut = btn("Shut the window");
      if (await visible(shut)) {
        await shut.dblclick();
        await page.waitForTimeout(300);
        continue;
      }
    }
    if (await visible(page.getByRole("region", { name: "League over" }))) {
      if (!seen.has("league")) {
        seen.add("league");
        await reloadAndCheck("League over", "League over");
        await noSideways("League over");
        await shot("league-over");
        if (await visible(btn("Quick sim"))) fail("Quick sim visible on the league-over stage");
      }
      const go = btn(/^(On to the play-offs|On to the Million Pound Game|Watch the play-offs)$/);
      const md = (await save()).matchdayIndex;
      await go.dblclick();
      await page.waitForTimeout(300);
      if ((await save()).matchdayIndex !== md) fail("passing the league-over stage also played the play-offs");
      continue;
    }
    if (await visible(page.getByRole("region", { name: "Promotion and relegation" }))) {
      if (!seen.has("promo")) {
        seen.add("promo");
        await reloadAndCheck("Promotion", "Promotion and relegation");
        await noSideways("Promotion");
        await shot("promotion");
      }
      const md = (await save()).matchdayIndex;
      await btn(/^(On to the Grand Final|Watch the Grand Final)$/).dblclick();
      await page.waitForTimeout(300);
      if ((await save()).matchdayIndex !== md) fail("passing the promotion stage also played the Grand Final");
      continue;
    }
    // A double tap that slipped into a live match: finish it and carry on (and flag it).
    if (await visible(btn("Skip to full time"))) {
      fail("a double tap started a live match");
      await btn("Skip to full time").click().catch(() => {});
      await page.waitForTimeout(400);
      await btn("Continue").click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
    const next = btn(/^(Quick sim|Continue)$/);
    if (await visible(next)) {
      // Triple tap: must never skip a stage.
      await next.click({ force: true, noWaitAfter: true }).catch(() => {});
      await next.click({ force: true, noWaitAfter: true }).catch(() => {});
      await next.click({ force: true, noWaitAfter: true }).catch(() => {});
    }
    await page.waitForTimeout(150);
  }
  for (const k of ["deadline", "league", "promo"]) if (!seen.has(k)) fail(`never saw the ${k} stage`);
  await page.getByText(/season review/i).first().waitFor({ timeout: 30000 });
  await reloadAndCheck("Season review");
  await shot("review");
  step(`Season played through every stage (${[...seen].join(", ")}) with reloads and double taps`);

  // Departures.
  await btn("Next: retirements and contracts").dblclick();
  await page.getByRole("heading", { name: "Comings and goings" }).waitFor({ timeout });
  await noSideways("Departures");
  await reloadAndCheck("Departures");
  await shot("departures");
  const s0 = await save();
  const expiring = s0.departures?.expiring ?? [];
  if (expiring.length) {
    const budget0 = s0.budget;
    const renew = btn(/^Renew /);
    if (await renew.isEnabled().catch(() => false)) {
      await renew.dblclick();
      await page.waitForTimeout(400);
      const s1 = await save();
      const renewedCount = (s1.departures?.renewed ?? []).length;
      if (renewedCount > 1) fail("double tap on Renew renewed two players");
      if (s1.budget >= budget0) fail("renewing didn't cost anything");
    }
    // Two tabs: let a player go in tab B while tab A is open; A must catch up, not resurrect him.
    const pageB = await context.newPage();
    await pageB.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
    const letGoB = pageB.getByRole("button", { name: "Let him go" }).first();
    if (await letGoB.isVisible().catch(() => false)) {
      await letGoB.click();
      await page.waitForTimeout(800);
      const left = (await save()).departures?.released ?? [];
      const shownA = await page.locator("main").innerText();
      if (left.length && !shownA.includes("Leaving on a free")) fail("tab A didn't pick up the release made in tab B");
    }
    await pageB.close();
    step(`Departures: ${expiring.length} out of contract; renew double tap, two tabs`);
  } else step("Departures: nobody out of contract this summer");
  await btn(/^(Open the transfer window|Continue to the window)$/).dblclick();
  // v1.18: releasing the out-of-contract list is confirmed in a sheet that lists who leaves.
  const confirmRelease = btn(/^Let \d+ go · open the window$/);
  if (await confirmRelease.waitFor({ state: "visible", timeout: 2_000 }).then(() => true, () => false)) await confirmRelease.dblclick().catch(() => {});
  await page.getByRole("heading", { name: "Build your squad" }).waitFor({ timeout });
  const sw = await save();
  if (sw.phase !== "transfers") fail(`double tap on Open the window landed on ${sw.phase}`);
  if (sw.clubs[sw.userClubId].squad.length < 20) fail(`squad under 20 after departures (${sw.clubs[sw.userClubId].squad.length})`);
  await reloadAndCheck("Transfer window");
  await noSideways("Transfer window");
  step("Transfer window opens once; squad at least 20");

  // Next season starts on pre-season again.
  await btn(/Start (the )?\d{4} season/).dblclick();
  await page.getByRole("region", { name: "Pre-season friendlies" }).waitFor({ timeout });
  const s2 = await save();
  if (s2.matchdayIndex !== 0 || s2.phase !== "season") fail("double tap on Start the season skipped ahead");
  step("Season 2 opens on pre-season (double tap safe)");
} catch (e) {
  fail(`run stopped after [${steps.at(-1) ?? "start"}]: ${String(e).split("\n")[0]}`);
  await shot("stopped");
}

if (consoleErrors.length) fail(`console errors: ${[...new Set(consoleErrors)].slice(0, 8).join(" | ")}`);
const report = `${steps.join("\n")}\n\n${problems.length} problem(s)\n${problems.map((p) => `- ${p}`).join("\n")}\n`;
fs.writeFileSync(`${OUT}/manager-break.txt`, report);
console.log(report);
await browser.close();
