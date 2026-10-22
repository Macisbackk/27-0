/**
 * End-to-end smoke test for Manager Mode against a running build (default http://localhost:3000).
 * Plays like a phone user: pick a club → play → tabs → sim season → review → transfers → next season → reload.
 * Fails on any uncaught page error or unexpected console error.
 *
 * CI: npm install --no-save playwright && npx playwright install --with-deps chromium && node scripts/e2e-career.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

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

const browser = await chromium.launch();
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
async function clickButton(name, opts = {}) {
  const btn = page.getByRole("button", { name, exact: opts.exact ?? false }).first();
  await btn.waitFor({ state: "visible", timeout });
  await btn.click();
}

try {
  await page.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Pick your club" }).waitFor({ timeout });
  step("Club picker renders");
  await shot("picker");

  // Championship is the default list; pick the first club.
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
  await page.getByRole("button", { name: "Play match" }).waitFor({ timeout });
  step(`Career started (${clubCount} Championship clubs listed)`);
  // Pre-season friendlies: pick two and play them.
  const pre = page.getByRole("region", { name: "Pre-season friendlies" });
  await pre.waitFor({ timeout });
  await shot("preseason");
  const friendlyButtons = pre.getByRole("button", { pressed: false });
  await friendlyButtons.nth(0).click();
  await friendlyButtons.nth(0).click();
  await pre.getByRole("button", { name: /^Play 2/ }).click();
  await page.getByRole("region", { name: "Pre-season results" }).waitFor({ timeout });
  step("Pre-season: played two friendlies");
  await shot("hub-match");

  await clickButton("Play match");
  await page.getByRole("region", { name: "Scoreboard" }).waitFor({ timeout });
  await page.waitForTimeout(1500);
  await shot("live-match");
  // Answer the first big call if it shows up, then skip to the end.
  for (let i = 0; i < 40; i++) {
    const call = page.getByRole("region", { name: /Penalty|team talk|Closing|Last tackle|Chasing|Big hole|Kick-off|Space in behind|Captain|down to 12|Injury|Fresh legs|Golden point/ });
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

  await page.getByRole("tab", { name: "Table" }).click();
  await page.locator("table").first().waitFor({ timeout });
  const rows = await page.locator("table tbody tr").count();
  if (rows !== 22) throw new Error(`Expected 22 table rows, saw ${rows}`);
  step("Table tab (22 rows)");
  await shot("table");

  await page.getByRole("tab", { name: "Club" }).click();
  await page.getByText("Season challenges").waitFor({ timeout });
  await shot("club");
  await clickButton("Legend Vault");
  await page.getByText("Legend Vault").first().waitFor({ timeout });
  await shot("vault");
  await page.keyboard.press("Escape");
  step("Club tab + Legend Vault");

  await page.getByRole("tab", { name: "Match" }).click();
  let shotDeadline = false;
  let shotBid = false;
  let shotWindow = false;
  for (let i = 0; i < 80; i++) {
    if (await page.getByText(/season review/i).first().isVisible().catch(() => false)) break;
    if (!shotWindow && (await page.getByRole("region", { name: "Transfer window" }).isVisible().catch(() => false))) {
      shotWindow = true;
      await shot("window-open");
    }
    if (!shotBid && (await page.getByRole("region", { name: "Transfer bid" }).isVisible().catch(() => false))) {
      shotBid = true;
      await shot("rival-bid");
    }
    if (!shotDeadline && (await page.getByRole("region", { name: "Deadline Day" }).isVisible().catch(() => false))) {
      shotDeadline = true;
      await page.waitForTimeout(6000); // let the ticker land
      await shot("deadline-day");
      if (await page.getByRole("button", { name: "Quick sim" }).isVisible().catch(() => false)) {
        throw new Error("Quick sim still offered while Deadline Day is open");
      }
      await page.getByRole("button", { name: /^Late signing$/ }).click().catch(() => {});
      await page.waitForTimeout(800);
      await shot("deadline-market");
      await page.getByRole("button", { name: /Back to the season/ }).click().catch(() => {});
      await page.waitForTimeout(500);
      await page.getByRole("tab", { name: "Table" }).click();
      await page.waitForTimeout(300);
      await page.locator("table tbody tr").nth(2).getByRole("button").first().click().catch(() => {});
      await page.waitForTimeout(800);
      await shot("club-team-sheet");
      await page.keyboard.press("Escape");
      await page.getByRole("tab", { name: "Club" }).click();
      await page.waitForTimeout(300);
      await shot("transfer-round-up");
      await page.getByRole("tab", { name: "Match" }).click();
      await page.waitForTimeout(300);
      await page.getByRole("button", { name: "Shut the window" }).first().click();
      await page.getByText(/Window shut/).first().waitFor({ timeout });
      step("Deadline Day paused the season, late market, club team sheet, transfer round-up, window shut");
    }
    const next = page.getByRole("button", { name: /^(Quick sim|Continue|Shut the window)$/ }).first();
    if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
    await page.waitForTimeout(120);
  }
  await page.getByText(/season review/i).first().waitFor({ timeout: 60_000 });
  step("Quick-simmed the season → review screen");
  await shot("review");

  await clickButton("Go to transfers");
  await page.getByRole("heading", { name: "Build your squad" }).waitFor({ timeout });
  await shot("transfers");
  await page.getByRole("tab", { name: "Sell" }).click();
  const sellButtons = page.getByRole("button", { name: /^Sell £/ });
  await sellButtons.first().waitFor({ timeout });
  await sellButtons.first().click();
  await page.getByRole("status").filter({ hasText: /Sold/ }).waitFor({ timeout });
  step("Transfer window: sold a player");

  await clickButton(/Start (the )?\d{4} season/);
  await page.getByRole("button", { name: "Play match" }).waitFor({ timeout });
  const headerText = await page.locator("header").filter({ hasText: /2027/ }).count();
  if (!headerText) throw new Error("Second season header did not show 2027");
  step("Second season (2027) started");

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play match" }).waitFor({ timeout });
  if (!(await page.locator("header").filter({ hasText: /2027/ }).count())) throw new Error("Career not restored after reload");
  step("Career persists across reload");

  await page.goto(`${BASE}/leaderboard`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Manager" }).first().click();
  await page.getByRole("region", { name: "Manager Mode records" }).or(page.getByLabel("Manager Mode records").first()).first().waitFor({ timeout });
  step("Leaderboard shows Manager Mode records");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /Manager Mode/ }).first().waitFor({ timeout });
  step("Home page Manager Mode card");
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
