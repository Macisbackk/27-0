/**
 * End-to-end smoke test for Manager Mode against a running build (default http://localhost:3000).
 * Plays like a phone user: pick a club → play → tabs → sim season → review → transfers → next season → reload.
 * Fails on any uncaught page error or unexpected console error.
 *
 * CI: npm install --no-save playwright && npx playwright install --with-deps chromium && node scripts/e2e-career.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { skipWelcome } from "./e2e-skip-welcome.mjs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const errors = [];
const steps = [];
const step = (msg) => {
  steps.push(msg);
  console.log(`✓ ${msg}`);
};

// Supabase is a placeholder in CI — network failures to it are expected, not bugs.
const IGNORED = [
  /supabase/i,
  /Failed to fetch/i,
  /ERR_NAME_NOT_RESOLVED/i,
  /fetch failed/i,
  /\[career-leaderboard\]/,
  /\[career\] cloud/,
  /Load failed/i,
  /net::ERR_/i,
  // Vercel Analytics only exists on Vercel; a plain `next start` 404s it.
  /_vercel\/insights/,
  // Generic resource-load messages carry no URL; real 404s are caught by the response listener below.
  /Failed to load resource/i,
];
/** Missing files that only exist on Vercel (or are placeholders) — not bugs. */
// /sounds/*.mp3 are optional: the sound manager probes once, then uses synth tones (public/sounds/README.md).
const IGNORED_URLS = [/\/_vercel\//, /supabase/i, /favicon/i, /\/sounds\/[\w-]+\.mp3$/];

const browser = skipWelcome(await chromium.launch());
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
});
const page = await context.newPage();
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
page.on("response", (res) => {
  if (res.status() < 400) return;
  const url = res.url();
  if (IGNORED_URLS.some((re) => re.test(url))) return;
  errors.push(`HTTP ${res.status()}: ${url}`);
});
page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  const text = msg.text();
  if (IGNORED.some((re) => re.test(text))) return;
  errors.push(`console: ${text}`);
});

const timeout = 20_000;

/** CI only: phone-sized screenshots saved to e2e-shots/ (published to a throwaway branch by the workflow). */
let shotCount = 0;
async function shot(name) {
  if (!process.env.CI) return;
  try {
    await page.waitForTimeout(400);
    shotCount += 1;
    mkdirSync("e2e-shots", { recursive: true });
    await page.screenshot({ path: `e2e-shots/${String(shotCount).padStart(2, "0")}-${name}.png`, scale: "css" });
  } catch (err) {
    console.log(`screenshot ${name} failed: ${err}`);
  }
}
async function dismissEvents() {
  // v1.55: hub pop-ups (legend signings, random events) sit over the page; Escape takes the default.
  for (let i = 0; i < 4; i++) {
    if (!(await page.getByTestId("career-event").isVisible().catch(() => false))) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

async function clickButton(name, opts = {}) {
  await dismissEvents();
  const btn = page.getByRole("button", { name, exact: opts.exact ?? false }).first();
  await btn.waitFor({ state: "visible", timeout });
  await btn.click({ timeout: 10_000 }).catch(async (e) => {
    await dismissEvents();
    await btn.click({ timeout }).catch(() => {
      throw e;
    });
  });
}

try {
  await page.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Pick your club" }).waitFor({ timeout });
  step("Club picker renders");
  await shot("picker");

  // v1.18: Super League is the default list; switch to the Championship and pick the first club.
  await page.getByRole("tab", { name: /^Champ/ }).click();
  const clubs = page.getByRole("list", { name: "Clubs" }).getByRole("button");
  await clubs.first().waitFor({ timeout });
  const clubCount = await clubs.count();
  if (clubCount !== 22) throw new Error(`Expected 22 Championship clubs, saw ${clubCount}`);
  await clubs.first().click();
  await page.getByPlaceholder("Your name").fill("E2E Coach");
  await clickButton(/Take charge of/);
  // First-save walkthrough: step through it.
  const tutorial = page.getByRole("dialog", { name: "Manager Mode walkthrough" });
  await tutorial.waitFor({ timeout });
  await shot("tutorial");
  for (let i = 0; i < 8 && (await tutorial.isVisible().catch(() => false)); i++) {
    await tutorial.getByRole("button", { name: /^(Next|Let's go)$/ }).click();
    await page.waitForTimeout(250);
  }
  if (await tutorial.isVisible().catch(() => false)) throw new Error("Walkthrough did not close");
  step("First-save walkthrough");
  step(`Career started (${clubCount} Championship clubs listed)`);
  if (await page.getByRole("button", { name: "Play match" }).isVisible().catch(() => false)) {
    throw new Error("Round 1 showing during pre-season");
  }
  // Pre-season friendlies: pick two and play them.
  const pre = page.getByRole("region", { name: "Pre-season friendlies" });
  await pre.waitFor({ timeout });
  await shot("preseason");
  // v1.18: two recommended friendlies are pre-picked; the full list sits behind "Change".
  await pre.getByRole("button", { name: "Change" }).click();
  if ((await pre.getByRole("button", { pressed: true }).count()) !== 2) throw new Error("Expected two pre-picked friendlies");
  await pre.getByRole("button", { name: /^Play 2/ }).click();
  // v1.29: the friendly results sit on the Round 1 screen (no extra "Start the season" tap).
  await page.getByRole("region", { name: "Pre-season results" }).waitFor({ timeout });
  await page.getByRole("button", { name: "Play match" }).waitFor({ timeout });
  await shot("preseason-results");
  if (!(await page.getByRole("region", { name: "Season progress" }).getByText(/Board:/).isVisible().catch(() => false))) {
    throw new Error("Season progress strip (board target) missing on the hub");
  }
  step("Pre-season: played two friendlies, results shown above Round 1; board target on the hub");
  await shot("hub-match");

  await clickButton("Play match");
  await page.getByRole("region", { name: "Scoreboard" }).waitFor({ timeout });
  await page.waitForTimeout(1500);
  await shot("live-match");
  // Answer the first big call if it shows up, then skip to the end.
  for (let i = 0; i < 40; i++) {
    const call = page.getByRole("dialog", { name: /Penalty|team talk|Closing|Last tackle|Chasing|Big hole|Kick-off|Space in behind|Captain|down to 12|Injury|Fresh legs|Golden point|Short side|High shot|Big crowd|Six again|Rain|going wide|blowing|Scrum-half down|Red card/ });
    if (await call.isVisible().catch(() => false)) {
      await shot("live-call");
      await call.getByRole("button").first().click();
      break;
    }
    await page.waitForTimeout(250);
  }
  await clickButton("Skip to full time");
  await page.getByRole("region", { name: "Full time" }).waitFor({ timeout });
  await shot("live-full-time");
  await clickButton("Continue");
  await page.getByText(/Last result/).first().waitFor({ timeout });
  step("Played a live match (call + skip) and saw the result");
  await page.getByText(/Last result/).first().scrollIntoViewIfNeeded();
  await shot("result");
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.getByRole("tab", { name: "Team" }).click();
  await page.getByText("Starting XIII").waitFor({ timeout });
  const shirt1 = page.getByRole("button", { name: /Shirt 1,/ });
  await shot("team");
  await shirt1.click();
  const sheetOptions = page.getByRole("dialog").getByRole("button");
  await sheetOptions.first().waitFor({ timeout });
  await page.keyboard.press("Escape");
  step("Team tab + player picker");

  // Interchange: four bench shirts (14–17) under the XIII; tapping one swaps in a squad player.
  const bench = page.getByRole("region", { name: "Interchange" });
  await bench.waitFor({ timeout });
  const benchShirts = bench.getByRole("button", { name: /^Shirt 1[4-7], interchange: / });
  if ((await benchShirts.count()) !== 4) throw new Error(`Expected 4 bench shirts, saw ${await benchShirts.count()}`);
  const shirt14 = bench.getByRole("button", { name: /^Shirt 14,/ });
  const before14 = await shirt14.getAttribute("aria-label");
  await shirt14.click();
  const pickFor14 = page.getByRole("dialog").getByRole("button", { name: /Age \d+/ }).first();
  await pickFor14.waitFor({ timeout });
  await pickFor14.click();
  await page.waitForTimeout(300);
  const after14 = await shirt14.getAttribute("aria-label");
  if (after14 === before14) throw new Error("Picking a squad player for shirt 14 didn't change the bench");
  await shot("team-bench");
  step("Interchange: 4 bench shirts, swap from the squad");

  // Captain row and the Academy list (3–4 prospects every pre-season).
  await page.getByTestId("captain").waitFor({ timeout });
  // v1.57: the Team tab is split (Starting 17 · Squad · Academy).
  await page.getByRole("tab", { name: "Academy", exact: true }).click();
  const academy = page.getByRole("region", { name: "Academy" });
  await academy.scrollIntoViewIfNeeded({ timeout });
  const prospects = await academy.getByRole("button", { name: "Promote" }).count();
  if (prospects < 3 || prospects > 4) throw new Error(`Expected 3–4 academy prospects, saw ${prospects}`);
  await shot("team-academy");
  step(`Captain on the Team tab; Academy with ${prospects} prospects`);

  await page.getByRole("tab", { name: "Table" }).click();
  await page.locator("table").first().waitFor({ timeout });
  const rows = await page.locator("table tbody tr").count();
  if (rows !== 22) throw new Error(`Expected 22 table rows, saw ${rows}`);
  step("Table tab (22 rows)");
  await shot("table");
  // v1.58: the Table tab's sections (League · Results · Fixtures · Cup).
  await page.getByRole("tab", { name: "Results", exact: true }).click();
  const yourResults = page.getByTestId("table-results");
  await yourResults.waitFor({ timeout });
  if ((await yourResults.getByRole("listitem").count()) < 1) throw new Error("Results: your results list is empty after a game");
  const roundResults = page.getByTestId("round-results");
  await roundResults.waitFor({ timeout });
  if ((await roundResults.getByRole("listitem").count()) !== 11) throw new Error(`Round results: expected 11 Championship games, saw ${await roundResults.getByRole("listitem").count()}`);
  await shot("table-results");
  await page.getByRole("tab", { name: "Fixtures", exact: true }).click();
  await page.getByRole("list", { name: "Your next games" }).waitFor({ timeout });
  await page.getByRole("tab", { name: "Cup", exact: true }).click();
  await page.getByTestId("table-cup").waitFor({ timeout });
  await page.getByRole("tab", { name: "League", exact: true }).click();
  await page.locator("table tbody tr").first().waitFor({ timeout });
  step("Table tab: Results (your results + round results), Fixtures and Cup");

  await page.getByRole("tab", { name: "Club" }).click();
  await page.getByText("Season challenges").waitFor({ timeout });
  await shot("club");
  // v1.57: the Club tab is split (Overview · Stats · Records · News).
  // Player stats, league stats and the club's Hall of Fame (real all-time records).
  await page.getByRole("tab", { name: "Stats", exact: true }).click();
  for (const id of ["squad-stats", "league-leaders"]) {
    await page.getByTestId(id).first().waitFor({ timeout });
  }
  await page.getByRole("tab", { name: "Records", exact: true }).click();
  await page.getByTestId("hall-of-fame").first().waitFor({ timeout });
  const hofRows = await page.getByTestId("hall-of-fame").first().locator("li").count();
  if (hofRows !== 4) throw new Error(`Expected 4 Hall of Fame records, saw ${hofRows}`);
  await page.getByTestId("hall-of-fame").first().scrollIntoViewIfNeeded();
  await shot("club-hall-of-fame");
  step("Club tab: player stats, league stats and Hall of Fame");
  await clickButton("Legend Vault");
  await page.getByText("Legend Vault").first().waitFor({ timeout });
  await shot("vault");
  await page.keyboard.press("Escape");
  step("Club tab + Legend Vault");

  await page.getByRole("tab", { name: "Match" }).click();
  let shotDeadline = false;
  let shotLeagueOver = false;
  let shotPromotion = false;
  let shotBid = false;
  let shotWindow = false;
  for (let i = 0; i < 80; i++) {
    if (await page.getByText(/season review/i).first().isVisible().catch(() => false)) break;
    // A hub pop-up (legend signing, random event) waits for an answer: take the default.
    if (await page.getByTestId("career-event").isVisible().catch(() => false)) await page.keyboard.press("Escape");
    if (!shotWindow && (await page.getByRole("region", { name: "Deadline Day coming" }).isVisible().catch(() => false))) {
      shotWindow = true;
      await shot("window-open");
    }
    if (!shotBid && (await page.getByRole("region", { name: "Transfer bid" }).isVisible().catch(() => false))) {
      shotBid = true;
      await shot("rival-bid");
    }
    if (!shotDeadline && (await page.getByRole("region", { name: "Deadline Day", exact: true }).isVisible().catch(() => false))) {
      shotDeadline = true;
      await page.waitForTimeout(6000); // let the ticker land
      await shot("deadline-day");
      if (await page.getByRole("button", { name: "Quick sim" }).isVisible().catch(() => false)) {
        throw new Error("Quick sim still offered while Deadline Day is open");
      }
      await page.getByRole("button", { name: /^Buy and sell$/ }).click().catch(() => {});
      await page.waitForTimeout(800);
      // v1.62: the Manager bottom bar stays up in the market (phones), not the site's main bar.
      if (!(await page.getByRole("navigation", { name: "Manager sections" }).isVisible().catch(() => false))) {
        throw new Error("Deadline Day market: the Manager bottom bar (nav \"Manager sections\") isn't showing");
      }
      if (await page.getByRole("navigation", { name: "Main" }).isVisible().catch(() => false)) {
        throw new Error("Deadline Day market: the site's main bottom bar is showing instead of the Manager one");
      }
      await shot("deadline-market");
      await page.getByRole("button", { name: /Back to Deadline Day/ }).click().catch(() => {});
      await page.waitForTimeout(500);
      await page.getByRole("tab", { name: "Table" }).click();
      await page.waitForTimeout(300);
      await page.locator("table tbody tr").nth(2).getByRole("button").first().click().catch(() => {});
      await page.waitForTimeout(800);
      await shot("club-team-sheet");
      await page.keyboard.press("Escape");
      await page.getByRole("tab", { name: "Club" }).click();
      await page.waitForTimeout(300);
      await page.getByRole("tab", { name: "Stats", exact: true }).click();
      await page.getByTestId("squad-stats").first().scrollIntoViewIfNeeded();
      await shot("club-player-stats");
      await page.getByTestId("league-leaders").first().scrollIntoViewIfNeeded();
      await shot("club-league-stats");
      await page.getByRole("tab", { name: "News", exact: true }).click();
      await page.getByRole("region", { name: "Transfer round-up" }).waitFor({ timeout });
      await shot("transfer-round-up");
      await page.getByRole("tab", { name: "Match" }).click();
      await page.waitForTimeout(300);
      await page.getByRole("button", { name: "Shut the window" }).first().click();
      await page.getByText(/Window shut/).first().waitFor({ timeout });
      step("Deadline Day paused the season, late market, club team sheet, transfer round-up, window shut");
    }
    if (!shotLeagueOver && (await page.getByRole("region", { name: "League over" }).isVisible().catch(() => false))) {
      shotLeagueOver = true;
      await shot("league-over");
      step("League over: its own stage before the play-offs");
    }
    if (!shotPromotion && (await page.getByRole("region", { name: "Promotion and relegation" }).isVisible().catch(() => false))) {
      shotPromotion = true;
      await shot("promotion");
      step("Promotion and relegation: its own stage before the Grand Final");
    }
    const next = page
      .getByRole("button", {
        name: /^(Quick sim|Continue|Shut the window|On to the play-offs|On to the semi-finals|On to the Million Pound Game|Watch the play-offs|On to the Grand Final|Watch the Grand Final)$/,
      })
      .first();
    if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
    await page.waitForTimeout(120);
  }
  await page.getByText(/season review/i).first().waitFor({ timeout: 60_000 });
  // v1.58: full time on the season (your last game, the Grand Final) before the review.
  const over = page.getByRole("region", { name: "Season over" });
  await over.waitFor({ timeout });
  await over.getByRole("region", { name: "Last result" }).waitFor({ timeout });
  await shot("season-over");
  await clickButton("See the season review");
  await page.getByTestId("season-review").waitFor({ timeout });
  step("Quick-simmed the season → full time → review screen");
  await shot("review");
  // The season's story: who won what, the play-off bracket, the cup and every result.
  const honours = page.getByTestId("honours-board");
  await honours.waitFor({ timeout });
  for (const id of ["grand-final", "league-leaders", "challenge-cup", "championship-title", "promoted", "relegated"]) {
    if (!(await honours.locator(`[data-honour="${id}"]`).count())) throw new Error(`Honours board is missing ${id}`);
  }
  await honours.scrollIntoViewIfNeeded();
  await shot("review-honours");
  const bracket = page.getByTestId("review-playoffs").getByTestId("playoff-bracket");
  await bracket.waitFor({ timeout });
  const ties = await bracket.getByRole("listitem").count();
  if (ties !== 5) throw new Error(`Play-off bracket: expected 5 ties (2 eliminators, 2 semis, final), saw ${ties}`);
  if (!(await bracket.getByTestId("playoff-byes").isVisible())) throw new Error("Play-off bracket: no byes line for the top two");
  await bracket.scrollIntoViewIfNeeded();
  await shot("review-playoffs");
  await page.getByTestId("review-cup").waitFor({ timeout });
  const results = page.getByTestId("review-results");
  await results.locator("summary").click();
  const games = await results.getByTestId("results-list").getByRole("listitem").count();
  if (games < 21) throw new Error(`Your results: expected every game (21+), saw ${games}`);
  await results.scrollIntoViewIfNeeded();
  await shot("review-results");
  await page.getByTestId("final-tables").getByRole("tab", { name: /Super League/ }).click();
  if ((await page.getByTestId("final-tables").locator("tbody tr").count()) !== 14) throw new Error("Final tables: Super League switch didn't show 14 clubs");
  step(`Season review: honours board, play-off bracket, cup, your ${games} results, both final tables`);
  const awards = page.getByRole("region", { name: "Season awards" });
  await awards.waitFor({ timeout });
  if (!(await awards.getByText("Man of Steel").first().isVisible().catch(() => false))) throw new Error("Season awards card has no Man of Steel");
  await awards.scrollIntoViewIfNeeded();
  await shot("review-awards");
  step("Season review: awards card (Man of Steel, Player of the Season)");

  if (!shotLeagueOver || !shotPromotion) throw new Error("League-over / promotion stages were not shown");
  await clickButton("Next: retirements and contracts");
  await page.getByRole("heading", { name: "Comings and goings" }).waitFor({ timeout });
  await shot("departures");
  const renewBtn = page.getByRole("button", { name: /^Renew · / }).first();
  if (await renewBtn.isVisible().catch(() => false)) {
    if (await renewBtn.isEnabled()) {
      await renewBtn.click();
      await page.getByText(/Renewed:/).first().waitFor({ timeout });
    }
  }
  await clickButton(/^(Open the transfer window|Continue to the window)$/);
  // v1.18: letting the out-of-contract list go asks first (lists who leaves).
  const confirmRelease = page.getByRole("button", { name: /^Let \d+ go · open the window$/ });
  if (await confirmRelease.waitFor({ state: "visible", timeout: 2_000 }).then(() => true, () => false)) await confirmRelease.click();
  step("Departures: retirements, contracts and academy before the window");
  await page.getByRole("heading", { name: "Build your squad" }).waitFor({ timeout });
  await shot("transfers");
  await page.getByRole("tab", { name: "Sell" }).click();
  const sellButtons = page.getByRole("button", { name: /^Sell £/ });
  await sellButtons.first().waitFor({ timeout });
  if (await sellButtons.first().isEnabled()) {
    await sellButtons.first().click();
    await page.getByRole("status").filter({ hasText: / joins |Sold / }).waitFor({ timeout });
    step("Transfer window: sold a player");
  } else {
    // Letting contracts run out can leave the squad at the 20-man minimum: selling is then (rightly) blocked.
    await page.getByRole("tab", { name: "Buy" }).click();
    const buy = page.getByRole("button", { name: /£/ }).and(page.locator("button:not([disabled])")).first();
    await buy.click();
    await page.getByRole("status").filter({ hasText: /Signed/ }).waitFor({ timeout });
    step("Transfer window: squad at the minimum, so signed a player instead");
  }

  await clickButton(/Start (the )?\d{4} season/);
  await page.getByRole("region", { name: "Pre-season friendlies" }).waitFor({ timeout });
  const headerText = await page.locator("header").filter({ hasText: /2027/ }).count();
  if (!headerText) throw new Error("Second season header did not show 2027");
  step("Second season (2027) started");

  // A new season can open with a hub pop-up (e.g. a legend signing) over the tabs: answer it first.
  await page.waitForTimeout(800);
  await dismissEvents();
  // Club → Records: last season, tappable, told again.
  await page.getByRole("tab", { name: "Club" }).click();
  await page.getByRole("tab", { name: "Records", exact: true }).click();
  const pastList = page.getByTestId("past-seasons");
  await pastList.waitFor({ timeout });
  await pastList.getByRole("button").first().click();
  const pastSheet = page.getByTestId("past-season");
  await pastSheet.waitFor({ timeout });
  await pastSheet.getByTestId("honours-board").waitFor({ timeout });
  await pastSheet.getByTestId("playoff-bracket").waitFor({ timeout });
  await shot("past-season");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Match" }).click();
  step("Club → Records: a past season opens its story (honours, bracket, results)");

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("region", { name: "Pre-season friendlies" }).waitFor({ timeout });
  if (!(await page.locator("header").filter({ hasText: /2027/ }).count())) throw new Error("Career not restored after reload");
  step("Career persists across reload");

  await page.goto(`${BASE}/leaderboard`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Manager" }).first().click();
  await page.getByRole("region", { name: "Manager Mode records" }).or(page.getByLabel("Manager Mode records").first()).first().waitFor({ timeout });
  step("Leaderboard shows Manager Mode records");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /Manager Mode/ }).first().waitFor({ timeout });
  step("Home page Manager Mode card");

  // v1.65: an NRL career. Brisbane (2025 premiers) open the season in the World Club Challenge v Hull KR.
  await page.evaluate(() => localStorage.removeItem("27-0-career-v2-save"));
  await page.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Pick your club" }).waitFor({ timeout });
  await page.getByRole("tab", { name: "NRL", exact: true }).click();
  const nrlClubs = page.getByRole("list", { name: "Clubs" }).getByRole("button");
  await nrlClubs.first().waitFor({ timeout });
  if ((await nrlClubs.count()) !== 17) throw new Error(`Expected 17 NRL clubs, saw ${await nrlClubs.count()}`);
  await shot("picker-nrl");
  await nrlClubs.filter({ hasText: "Brisbane Broncos" }).first().click();
  await clickButton(/Take charge of Brisbane Broncos/);
  await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
  step("NRL career started (17 NRL clubs listed): Brisbane Broncos");
  await page.getByRole("region", { name: "Pre-season friendlies" }).waitFor({ timeout });
  await page.getByTestId("wcc-banner").waitFor({ timeout });
  await clickButton(/^Skip pre-season/);
  const wccBanner = page.getByTestId("wcc-banner");
  await wccBanner.waitFor({ timeout });
  if (!(await wccBanner.getByText(/Hull KR/).first().isVisible().catch(() => false))) throw new Error("WCC banner doesn't name Hull KR");
  await shot("nrl-wcc-banner");
  await clickButton("Play match");
  await page.getByRole("region", { name: "Scoreboard" }).waitFor({ timeout });
  await clickButton("Skip to full time");
  await page.getByRole("region", { name: "Full time" }).waitFor({ timeout });
  await clickButton("Continue");
  await page.getByText(/Last result · World Club Challenge/).first().waitFor({ timeout });
  await shot("nrl-wcc-result");
  await dismissEvents();
  step("World Club Challenge: banner, played live, result");
  await page.getByRole("tab", { name: "Table" }).click();
  await page.getByRole("tab", { name: "League", exact: true }).click();
  await page.locator("table tbody tr").first().waitFor({ timeout });
  const nrlRows = await page.locator("table tbody tr").count();
  if (nrlRows !== 17) throw new Error(`Expected a 17-club NRL ladder, saw ${nrlRows}`);
  await shot("nrl-table");
  await page.getByRole("tab", { name: "Finals", exact: true }).click();
  await page.getByTestId("table-wcc").waitFor({ timeout });
  await page.getByRole("tab", { name: "Fixtures", exact: true }).click();
  await page.getByTestId("nrl-byes").waitFor({ timeout });
  await page.getByRole("tab", { name: "League", exact: true }).click();
  step("NRL ladder (17), Finals view with the WCC, your byes");
  await page.getByRole("tab", { name: "Match" }).click();
  await clickButton("Quick sim");
  await page.getByText(/Last result · Round/).first().waitFor({ timeout });
  step("NRL Round played");
} catch (err) {
  errors.push(`step failed after [${steps.at(-1) ?? "start"}]: ${err instanceof Error ? err.message : String(err)}`);
}

await browser.close();
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nE2E PASSED: ${steps.length} steps`);
if (process.env.CI) console.log(`::notice title=Manager Mode e2e passed (${steps.length} steps)::${steps.join("%0A")}`);
