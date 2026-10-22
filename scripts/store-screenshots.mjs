/**
 * Store listing images, made from the real game (CI runs this against `next start`):
 * - store-shot-*.png      phone screenshots at 1080×1920 (Google Play / App Store friendly)
 * - store-feature-graphic.png  1024×500 Google Play feature graphic
 * Report only — never fails the build.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
mkdirSync("e2e-shots", { recursive: true });
const browser = await chromium.launch();
const log = [];

const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const shot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: `e2e-shots/store-shot-${name}.png` }).catch((e) => log.push(`${name}: ${e.message}`));
  log.push(`store-shot-${name}.png`);
};
const go = async (route, ms = 1200) => {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
};
const tap = async (re) => {
  const b = page.getByRole("button", { name: re }).first();
  if (await b.isVisible().catch(() => false)) {
    await b.click().catch(() => {});
    return true;
  }
  return false;
};

try {
  // 1. Home
  await go("/");
  await shot("1-home");

  // 2. Classic team sheet with club shirts
  await go("/play", 1500);
  await tap(/Skip boost|Continue without boost/i);
  await page.waitForTimeout(600);
  await tap(/Auto.?fill squad/i);
  await page.waitForTimeout(1500);
  await page.locator(".team-sheet-pitch").first().scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: "e2e-shots/store-shot-2-team-sheet.png" });
  log.push("store-shot-2-team-sheet.png");

  // 3. Manager Mode: a live match call
  await go("/manager", 1200);
  await page.getByRole("tab", { name: /Super League/ }).click().catch(() => {});
  await page.getByRole("list", { name: "Clubs" }).getByRole("button").first().click().catch(() => {});
  await page.getByPlaceholder("Your name").fill("Coach").catch(() => {});
  await tap(/Take charge of/);
  await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
  await page.getByRole("button", { name: "Skip pre-season" }).click({ timeout: 8000 }).catch(() => {});
  await page.getByRole("button", { name: "Play match" }).waitFor({ timeout: 15000 }).catch(() => {});
  await tap(/^Play match$/);
  const call = page.getByRole("region", { name: /Penalty|team talk|Closing|Last tackle|Chasing|Big hole|Kick-off|Space in behind|Captain|down to 12|Injury|Fresh legs|Golden point/ });
  await call.waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);
  await shot("3-manager-live-match");

  // 4. Daily Challenge
  await go("/play?daily=1", 1500);
  await shot("4-daily-challenge");

  // 5. Grid puzzle
  await go("/mini-games/grid", 1500);
  await shot("5-grid");

  // 6. Millionaire
  await go("/mini-games/quiz", 1200);
  await tap(/Start quiz|Super League Millionaire|^Play/i);
  await page.waitForTimeout(1200);
  await shot("6-millionaire");
} catch (e) {
  log.push(`screenshots stopped: ${e instanceof Error ? e.message : String(e)}`);
}
await ctx.close();

// Feature graphic (1024×500) in the Floodlights look.
const art = await browser.newPage({ viewport: { width: 1024, height: 500 } });
const shirt = (body, trim, pattern) => {
  const clip = `c${Math.random().toString(36).slice(2, 7)}`;
  const path = "M16 3 L7 7 L1 17 L8 22 L11 19 L11 44 L37 44 L37 19 L40 22 L47 17 L41 7 L32 3 C29 8 19 8 16 3 Z";
  const pat =
    pattern === "hoops"
      ? [9, 21, 33].map((y) => `<rect x="0" y="${y}" width="48" height="6" fill="${trim}"/>`).join("")
      : pattern === "band"
        ? `<rect x="0" y="16" width="48" height="10" fill="${trim}"/>`
        : `<polygon points="8,0 24,27 40,0 31,0 24,13 17,0" fill="${trim}"/>`;
  return `<svg width="150" height="144" viewBox="0 0 48 46"><defs><clipPath id="${clip}"><path d="${path}"/></clipPath></defs><g clip-path="url(#${clip})"><rect width="48" height="46" fill="${body}"/>${pat}</g><path d="M16 3 C19 8 29 8 32 3" fill="none" stroke="${trim}" stroke-width="2.5"/><path d="${path}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/></svg>`;
};
await art.setContent(`<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@500;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;width:1024px;height:500px;background:#0a110e;font-family:Inter,sans-serif;color:#eef5f0;overflow:hidden;position:relative}
  .glow{position:absolute;right:-120px;top:-160px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,rgba(74,222,128,.18),transparent 65%)}
  .pitch{position:absolute;right:0;top:0;bottom:0;width:470px;background:repeating-linear-gradient(180deg,#15391f 0 50px,#123219 50px 100px);clip-path:polygon(18% 0,100% 0,100% 100%,0 100%)}
  .copy{position:absolute;left:64px;top:92px}
  .logo{font-family:Anton,Impact,sans-serif;font-size:150px;line-height:1;color:#4ade80;letter-spacing:1px}
  .logo span{color:#eef5f0}
  .tag{margin-top:18px;font-size:34px;font-weight:700}
  .sub{margin-top:10px;font-size:22px;color:#a7b8ae;font-weight:500}
  .shirts{position:absolute;right:40px;top:70px;display:grid;grid-template-columns:repeat(2,150px);gap:18px 26px}
  .shirts svg{filter:drop-shadow(0 10px 18px rgba(0,0,0,.5))}
</style></head><body>
<div class="pitch"></div><div class="glow"></div>
<div class="copy"><div class="logo">27-<span>0</span></div><div class="tag">Build a 13. Go 27-0.</div><div class="sub">Rugby league manager &amp; squad builder</div></div>
<div class="shirts">${shirt("#8B1538", "#FFFFFF", "hoops")}${shirt("#FFFFFF", "#E30613", "v")}${shirt("#0066B3", "#FDB913", "band")}${shirt("#FDB913", "#111111", "hoops")}</div>
</body></html>`);
await art.waitForTimeout(1500);
await art.screenshot({ path: "e2e-shots/store-feature-graphic.png" });
log.push("store-feature-graphic.png");

await browser.close();
console.log(log.join("\n"));
