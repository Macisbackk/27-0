/**
 * Save reliability check (v1.66 health check), against a running build (default localhost:3000).
 *
 * Plays as a guest on a phone profile with a persistent browser profile, then checks that
 * the progress survives: a refresh, a full browser restart, and moving around every page.
 * Fails if any saved key disappears or the Manager career doesn't come back.
 *
 * (Device changes after registering go through the cloud: that path is covered by the unit
 * tests for each cloud merge, e.g. scripts/test-device-stats-merge.ts, because CI has no
 * real Supabase account to sign in with.)
 *
 * Run: node scripts/health-save-reliability.mjs [baseUrl]
 */
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, devices } from "playwright";

const BASE = (process.argv[2] || process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const CAREER_KEY = "27-0-career-v2-save";
const timeout = 30_000;
const profileDir = mkdtempSync(join(tmpdir(), "27-0-save-"));
const { defaultBrowserType: _ignored, ...phone } = devices["Pixel 5"];

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function open() {
  const ctx = await chromium.launchPersistentContext(profileDir, { ...phone });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  return { ctx, page };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("27-0")) out[k] = localStorage.getItem(k);
    }
    return out;
  });
}

function careerSummary(raw) {
  try {
    const s = JSON.parse(raw);
    const c = s && typeof s === "object" && "state" in s ? s.state : s;
    return c ? `${c.userClubId}|${c.year}|${c.seasonNumber}|${c.matchdayIndex}|${c.managerName}` : null;
  } catch {
    return null;
  }
}

async function dismissDialogs(page) {
  for (let i = 0; i < 4; i++) {
    const ev = page.locator('[data-testid="career-event"]');
    if (!(await ev.isVisible().catch(() => false))) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
}

let failed = false;
try {
  // 1. Guest plays: start a Manager career and play the pre-season.
  let { ctx, page } = await open();
  await page.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Pick your club" }).waitFor({ timeout });
  const clubs = page.getByRole("list", { name: "Clubs" }).getByRole("button");
  await clubs.first().click();
  await page.getByPlaceholder("Your name").fill("Save Check");
  await page.getByRole("button", { name: /Take charge of/ }).click();
  const tutorial = page.getByRole("dialog", { name: "Manager Mode walkthrough" });
  await tutorial.waitFor({ timeout });
  for (let i = 0; i < 10 && (await tutorial.isVisible().catch(() => false)); i++) {
    await tutorial.getByRole("button", { name: /^(Next|Let's go)$/ }).click();
    await page.waitForTimeout(200);
  }
  const pre = page.getByRole("region", { name: "Pre-season friendlies" });
  if (await pre.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await pre.getByRole("button", { name: /^Play \d/ }).first().click();
  }
  await page.getByRole("button", { name: "Play match" }).waitFor({ timeout });
  await dismissDialogs(page);
  // Guest mini-game history (as the Wordle page saves it).
  await page.evaluate(() => {
    localStorage.setItem(
      "27-0-wordle-stats",
      JSON.stringify({ schemaVersion: 3, played: 3, wins: 2, currentStreak: 1, maxStreak: 2, guessDistribution: [0, 1, 1, 0, 0, 0], lastPlayedDate: null })
    );
  });
  await page.waitForTimeout(1500);
  const base = await snapshot(page);
  const baseCareer = careerSummary(base[CAREER_KEY]);
  check("Career saved as a guest", Boolean(baseCareer), baseCareer ?? "no save");
  const baseKeys = Object.keys(base).sort();

  // 2. Refresh.
  await page.reload({ waitUntil: "networkidle" });
  const afterReload = await page.getByRole("button", { name: "Play match" }).isVisible({ timeout }).catch(() => false);
  check("Refresh: career hub comes back", afterReload);
  let snap = await snapshot(page);
  check("Refresh: same career", careerSummary(snap[CAREER_KEY]) === baseCareer, careerSummary(snap[CAREER_KEY]) ?? "lost");
  check("Refresh: no saved key lost", baseKeys.every((k) => k in snap), baseKeys.filter((k) => !(k in snap)).join(", "));

  // 3. Full browser restart (same phone profile).
  await ctx.close();
  ({ ctx, page } = await open());
  await page.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
  const afterRestart = await page.getByRole("button", { name: "Play match" }).isVisible({ timeout }).catch(() => false);
  check("Browser restart: career hub comes back", afterRestart);
  snap = await snapshot(page);
  check("Browser restart: same career", careerSummary(snap[CAREER_KEY]) === baseCareer, careerSummary(snap[CAREER_KEY]) ?? "lost");
  check("Browser restart: no saved key lost", baseKeys.every((k) => k in snap), baseKeys.filter((k) => !(k in snap)).join(", "));

  // 4. Every main page, then back.
  for (const path of ["/", "/play", "/mini-games", "/mini-games/wordle", "/store", "/squad-book", "/leaderboard", "/profile", "/settings", "/stats"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(500);
  }
  snap = await snapshot(page);
  check("All pages visited: no saved key lost", baseKeys.every((k) => k in snap), baseKeys.filter((k) => !(k in snap)).join(", "));
  let wordle = null;
  try {
    wordle = JSON.parse(snap["27-0-wordle-stats"] || "null");
  } catch {
    wordle = null;
  }
  check("Wordle history kept", wordle?.played === 3, `played ${wordle?.played}`);
  check("Career still the same", careerSummary(snap[CAREER_KEY]) === baseCareer);

  // 5. Restart once more mid-season after playing a round.
  await page.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
  await dismissDialogs(page);
  await page.getByRole("button", { name: "Play match" }).click();
  await page.waitForTimeout(1500);
  for (const name of [/^Skip/, /^Sim to full time/, /^Full time/, /^Continue/, /^Done/]) {
    const b = page.getByRole("button", { name }).first();
    if (await b.isVisible().catch(() => false)) {
      await b.click().catch(() => {});
      await page.waitForTimeout(600);
    }
  }
  await page.waitForTimeout(1500);
  const played = careerSummary((await snapshot(page))[CAREER_KEY]);
  await ctx.close();
  ({ ctx, page } = await open());
  await page.goto(`${BASE}/manager`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const playedAfter = careerSummary((await snapshot(page))[CAREER_KEY]);
  check("Round played, restart: progress kept", Boolean(played) && played === playedAfter, `${played} → ${playedAfter}`);
  await ctx.close();
} catch (err) {
  check("Run completed", false, String(err?.message || err).split("\n")[0]);
}

failed = checks.some((c) => !c.ok);
const md =
  `# Save reliability (guest, phone)\n\n| Check | Result | Detail |\n|---|---|---|\n` +
  checks.map((c) => `| ${c.name} | ${c.ok ? "✅" : "❌"} | ${c.detail.replace(/\|/g, "/")} |`).join("\n") +
  "\n";
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
process.exit(failed ? 1 : 0);
