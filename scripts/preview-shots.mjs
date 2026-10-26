/**
 * Quick preview screenshots of the main screens (phone + one desktop), for showing a branch
 * without deploying it. Each shot is independent: one failure doesn't stop the rest.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "preview-shots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 } });

async function shot(ctx, name, path, act, fullPage = false) {
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(900);
    if (act) await act(page);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
    console.log("shot", name);
  } catch (e) {
    console.log("skip", name, String(e).slice(0, 160));
  } finally {
    await page.close();
  }
}

const tap = (re) => async (page) => {
  await page.getByRole("button", { name: re }).first().click({ timeout: 5000 });
  await page.waitForTimeout(700);
};

await shot(phone, "01-home", "/");
await shot(phone, "02-home-full", "/", null, true);
await shot(phone, "03-menu", "/", tap(/open menu/i));
await shot(phone, "04-classic-how-to", "/play");
await shot(phone, "05-classic-pitch", "/play", tap(/let.?s play/i));
await shot(phone, "06-manager", "/manager");
await shot(phone, "07-store", "/store");
await shot(phone, "08-leaderboard", "/leaderboard");
await shot(phone, "09-puzzles", "/mini-games");
await shot(phone, "10-profile", "/profile");
await shot(desktop, "11-desktop-home", "/");
await shot(desktop, "12-desktop-leaderboard", "/leaderboard");
await shot(desktop, "13-desktop-store", "/store");
await shot(desktop, "14-desktop-puzzles", "/mini-games");
await shot(desktop, "15-desktop-profile", "/profile");
await shot(phone, "20-showcase", "/showcase");
await shot(phone, "21-showcase-historic", "/showcase", async (page) => {
  await page.getByRole("button", { name: "Historic", exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(500);
});
await shot(phone, "22-showcase-filters", "/showcase", async (page) => {
  await page.getByRole("button", { name: /^Filters/ }).click({ timeout: 5000 });
  await page.waitForTimeout(500);
});
await shot(phone, "23-showcase-player", "/showcase", async (page) => {
  await page.getByRole("button", { name: "Historic", exact: true }).click({ timeout: 5000 });
  await page.locator(".showcase-row__button").first().click({ timeout: 5000 });
  await page.waitForTimeout(700);
});
await shot(desktop, "24-desktop-showcase", "/showcase");
// The logo follows the Store theme: fake a blue theme accent and look at the header.
await shot(phone, "25-logo-blue-theme", "/", async (page) => {
  await page.evaluate(() => document.documentElement.style.setProperty("--ui-accent", "#38bdf8"));
  await page.waitForTimeout(300);
});
await shot(phone, "16-store-frames", "/store", async (page) => {
  await page.getByRole("tab", { name: "Frames" }).click({ timeout: 5000 });
  await page.waitForTimeout(600);
});
await shot(phone, "17-manager-preseason", "/manager", async (page) => {
  await page.getByRole("list", { name: "Clubs" }).getByRole("button").first().click({ timeout: 5000 });
  await page.getByRole("button", { name: /Take charge of/ }).click({ timeout: 5000 });
  await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
});
await shot(desktop, "18-desktop-manager", "/manager");
// v1.18 shell: bottom nav (Home · Classic · Manager · Puzzles · Profile) stays up on Manager and
// the puzzles; the Store opens on "For you"; login leads with the form.
await shot(phone, "26-home-first-run", "/");
await shot(phone, "27-manager-with-nav", "/manager");
await shot(phone, "28-wordle-with-nav", "/mini-games/wordle");
await shot(phone, "29-store-for-you", "/store");
await shot(phone, "30-login", "/login");
await shot(phone, "31-menu-full", "/", tap(/open menu/i), true);

// Returning player: a finished Classic season on this device (best record, no first-run hero).
{
  const back = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await back.addInitScript(() => {
    if (localStorage.getItem("27-0-stats")) return;
    localStorage.setItem("27-0-stats-schema-version", "3");
    localStorage.setItem(
      "27-0-stats",
      JSON.stringify({ normal: { totalRuns: 4, totalSeasonsSimulated: 3, bestRecordWins: 24, bestRecordLosses: 3 } }),
    );
  });
  await shot(back, "32-home-returning", "/", null, true);
  await shot(back, "33-home-missions-open", "/", async (page) => {
    await page.getByRole("button", { name: /Today's missions/ }).click({ timeout: 5000 });
    await page.waitForTimeout(400);
  }, true);
  await shot(back, "34-home-era", "/", async (page) => {
    await page.getByRole("button", { name: /Every era/ }).click({ timeout: 5000 });
    await page.waitForTimeout(400);
  });
  await back.close();
}

await browser.close();
