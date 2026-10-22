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
await shot(desktop, "12-desktop-classic", "/play", tap(/let.?s play/i));

await browser.close();
