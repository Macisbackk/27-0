/**
 * End-to-end smoke test for Manager Mode against a running build (default http://localhost:3000).
 * Plays like a phone user: pick a club → play → tabs → sim season → review → transfers → next season → reload.
 * Fails on any uncaught page error or unexpected console error.
 *
 * CI: npm install --no-save playwright && npx playwright install --with-deps chromium && node scripts/e2e-career.mjs
 */
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
const IGNORED_URLS = [/\/_vercel\//, /supabase/i, /favicon/i];

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
async function clickButton(name, opts = {}) {
  const btn = page.getByRole("button", { name, exact: opts.exact ?? false }).first();
  await btn.waitFor({ state: "visible", timeout });
  await btn.click();
}

try {
  await page.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Pick your club" }).waitFor({ timeout });
  step("Club picker renders");

  // Championship is the default list; pick the first club.
  const clubs = page.getByRole("list", { name: "Clubs" }).getByRole("button");
  await clubs.first().waitFor({ timeout });
  const clubCount = await clubs.count();
  if (clubCount !== 22) throw new Error(`Expected 22 Championship clubs, saw ${clubCount}`);
  await clubs.first().click();
  await page.getByPlaceholder("Your name").fill("E2E Coach");
  await clickButton(/Take charge of/);
  await page.getByRole("button", { name: "Play match" }).waitFor({ timeout });
  step(`Career started (${clubCount} Championship clubs listed)`);

  await clickButton("Play match");
  await page.getByText(/Last result/).first().waitFor({ timeout });
  step("Played a match and saw the result");

  await page.getByRole("tab", { name: "Team" }).click();
  await page.getByText("Starting XIII").waitFor({ timeout });
  const shirt1 = page.getByRole("button", { name: /Shirt 1,/ });
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

  await page.getByRole("tab", { name: "Club" }).click();
  await page.getByText("Season challenges").waitFor({ timeout });
  await clickButton("Legend Vault");
  await page.getByText("Legend Vault").first().waitFor({ timeout });
  await page.keyboard.press("Escape");
  step("Club tab + Legend Vault");

  await page.getByRole("tab", { name: "Match" }).click();
  await clickButton("Sim season");
  await page.getByText(/season review/i).first().waitFor({ timeout: 60_000 });
  step("Simulated the season → review screen");

  await clickButton("Open the transfer window");
  await page.getByRole("heading", { name: "Build your squad" }).waitFor({ timeout });
  await page.getByRole("tab", { name: "Sell" }).click();
  const sellButtons = page.getByRole("button", { name: /^Sell £/ });
  await sellButtons.first().waitFor({ timeout });
  await sellButtons.first().click();
  await page.getByRole("status").filter({ hasText: /Sold/ }).waitFor({ timeout });
  step("Transfer window: sold a player");

  await clickButton(/Start the \d{4} season/);
  await page.getByRole("button", { name: "Play match" }).waitFor({ timeout });
  const headerText = await page.locator("header").filter({ hasText: /2027/ }).count();
  if (!headerText) throw new Error("Second season header did not show 2027");
  step("Second season (2027) started");

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play match" }).waitFor({ timeout });
  if (!(await page.locator("header").filter({ hasText: /2027/ }).count())) throw new Error("Career not restored after reload");
  step("Career persists across reload");

  await page.goto(`${BASE}/leaderboard`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Career records" }).waitFor({ timeout });
  step("Leaderboard shows Manager Mode records");

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /Play Manager Mode/ }).first().waitFor({ timeout });
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
