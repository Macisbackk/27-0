/**
 * Menu flicker probe: opens/closes the site menu on an iPhone (WebKit) and an Android phone (Chromium),
 * records video, and logs every animation frame so jumps and flashes show up as numbers.
 * Writes e2e-shots/flicker-*.png (frame strips) + e2e-shots/flicker.txt. Report only.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { chromium, devices, webkit } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
mkdirSync("e2e-shots", { recursive: true });
mkdirSync("/tmp/flicker-video", { recursive: true });
const report = [];

const PROBE = () => {
  const w = window;
  w.__frames = [];
  const q = (s) => document.querySelector(s);
  const tick = (t) => {
    const header = q(".app-header");
    const main = q("main") || q(".app-main");
    const panel = q(".sidebar-panel");
    const backdrop = q('button[aria-label="Close menu"]');
    const nav = q(".fl-bottom-nav");
    w.__frames.push({
      t: Math.round(t),
      sy: Math.round(w.scrollY),
      ih: w.innerHeight,
      vv: Math.round(w.visualViewport ? w.visualViewport.height : 0),
      htmlOv: document.documentElement.style.overflow || "",
      bodyPad: document.body.style.paddingRight || "",
      hTop: header ? Math.round(header.getBoundingClientRect().top) : null,
      mTop: main ? Math.round(main.getBoundingClientRect().top) : null,
      mH: main ? Math.round(main.getBoundingClientRect().height) : null,
      mKids: main ? main.childElementCount : null,
      navTop: nav ? Math.round(nav.getBoundingClientRect().top) : null,
      px: panel ? Math.round(panel.getBoundingClientRect().left) : null,
      bo: backdrop ? Number(getComputedStyle(backdrop).opacity).toFixed(2) : null,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

function analyse(label, frames) {
  const issues = [];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1];
    const b = frames[i];
    for (const k of ["sy", "hTop", "mTop", "navTop", "ih", "vv"]) {
      if (a[k] != null && b[k] != null && Math.abs(a[k] - b[k]) >= 2) issues.push(`${b.t}ms ${k} ${a[k]}→${b[k]}`);
    }
    if (a.mKids != null && b.mKids === 0) issues.push(`${b.t}ms main emptied`);
    if (a.mH != null && b.mH != null && Math.abs(a.mH - b.mH) > 40) issues.push(`${b.t}ms main height ${a.mH}→${b.mH}`);
    if (a.bo != null && b.bo != null && a.px != null && b.px != null) {
      // Panel should move monotonically within one open/close.
    }
    if (a.bodyBg !== b.bodyBg) issues.push(`${b.t}ms body background ${a.bodyBg}→${b.bodyBg}`);
    if (a.htmlOv !== b.htmlOv) issues.push(`${b.t}ms html overflow '${a.htmlOv}'→'${b.htmlOv}'`);
  }
  // Panel position trace (open/close should be smooth, no snap-backs).
  const px = frames.filter((f) => f.px != null).map((f) => f.px);
  const bo = frames.filter((f) => f.bo != null).map((f) => f.bo);
  report.push(`\n## ${label}: ${frames.length} frames, ${issues.length} jump(s)`);
  report.push(...issues.slice(0, 60).map((s) => `- ${s}`));
  report.push(`panel x: ${px.slice(0, 80).join(",")}`);
  report.push(`backdrop opacity: ${bo.slice(0, 80).join(",")}`);
}

async function run(name, browserType, device, route) {
  const browser = await browserType.launch();
  const ctx = await browser.newContext({ ...device, recordVideo: { dir: "/tmp/flicker-video", size: { width: device.viewport.width, height: device.viewport.height } } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(400);
  await page.evaluate(PROBE);
  const open = () => page.getByRole("button", { name: "Open menu" }).click().catch((e) => report.push(`${name}: open failed ${e.message}`));
  await open();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Close", exact: true }).click().catch(() => {});
  await page.waitForTimeout(700);
  await open();
  await page.waitForTimeout(700);
  await page.mouse.click(10, device.viewport.height / 2).catch(() => {}); // backdrop
  await page.waitForTimeout(700);
  await open();
  await page.waitForTimeout(700);
  await page.getByRole("dialog", { name: "Site menu" }).getByRole("link", { name: "Leaderboard" }).click().catch(() => {});
  await page.waitForTimeout(1500);
  const frames = await page.evaluate(() => window.__frames || []).catch(() => []);
  analyse(`${name} ${route}`, frames);
  const video = page.video();
  await ctx.close();
  await browser.close();
  const path = video ? await video.path() : null;
  if (path) {
    try {
      // 4 fps strip of the whole sequence, 12 frames per row.
      execSync(`ffmpeg -loglevel error -y -i "${path}" -vf "fps=8,scale=180:-1,tile=12x6" -frames:v 1 e2e-shots/flicker-${name}-${route.replace(/\W+/g, "") || "home"}.png`);
    } catch (e) {
      report.push(`ffmpeg failed: ${e.message.slice(0, 200)}`);
    }
  }
}

for (const route of ["/", "/leaderboard"]) {
  await run("iphone-webkit", webkit, devices["iPhone 13"], route);
  await run("android-chromium", chromium, devices["Pixel 7"], route);
}
writeFileSync("e2e-shots/flicker.txt", report.join("\n") + "\n");
console.log(report.join("\n").slice(0, 15000));
console.log(readdirSync("e2e-shots").filter((f) => f.startsWith("flicker")).join("\n"));
