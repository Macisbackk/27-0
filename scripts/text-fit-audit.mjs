/**
 * Text-fit audit: on every route (and the site menu, Classic pitch, Manager hub) at 320 / 375 / 768 / 1280px,
 * find text that is clipped, ellipsised, line-clamped, pushed off-screen or rendered tiny.
 * Writes e2e-shots/text-fit.txt (+ a few screenshots). Report only — never fails the build.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const ROUTES = [
  "/", "/play", "/play?era=1", "/play?daily=1", "/manager", "/mini-games", "/mini-games/quiz", "/mini-games/wordle", "/mini-games/grid",
  "/leaderboard", "/profile", "/store", "/showcase", "/settings", "/login", "/modes", "/modes/past-dailies",
  "/auth/reset-password",
];
const VIEWPORTS = [
  { name: "320", width: 320, height: 640, mobile: true },
  { name: "375", width: 375, height: 812, mobile: true },
  { name: "768", width: 768, height: 1024, mobile: true },
  { name: "1280", width: 1280, height: 800, mobile: false },
];
mkdirSync("e2e-shots", { recursive: true });

/** Runs in the page: returns text that doesn't fit. */
function scan() {
  const out = [];
  const seen = new Set();
  const vw = document.documentElement.clientWidth;
  const label = (el) => {
    const t = (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    return t.slice(0, 60);
  };
  const where = (el) => {
    const parts = [];
    let n = el;
    for (let i = 0; n && i < 3; i++, n = n.parentElement) {
      const cls = (typeof n.className === "string" ? n.className : "").split(/\s+/).filter((c) => c && !c.includes(":") && !c.includes("[")).slice(0, 2).join(".");
      parts.unshift(`${n.tagName.toLowerCase()}${cls ? "." + cls : ""}`);
    }
    return parts.join(">");
  };
  for (const el of document.querySelectorAll("body *")) {
    if (!(el instanceof HTMLElement)) continue;
    const hasOwnText = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 1);
    if (!hasOwnText) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") continue;
    if (el.closest("[aria-hidden='true'], .sr-only, footer")) continue;
    const text = label(el);
    if (!text) continue;
    const key = text + "|" + where(el);
    if (seen.has(key)) continue;
    const issues = [];
    const clipsX = /hidden|clip/.test(cs.overflowX) || cs.textOverflow === "ellipsis";
    if (clipsX && el.scrollWidth > el.clientWidth + 1) issues.push(cs.textOverflow === "ellipsis" ? "ellipsis" : "clipped-x");
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== "none";
    if ((clamp || /hidden|clip/.test(cs.overflowY)) && el.scrollHeight > el.clientHeight + 2) issues.push(clamp ? "line-clamped" : "clipped-y");
    if (r.right > vw + 1 || r.left < -1) issues.push("off-screen");
    const fs = parseFloat(cs.fontSize);
    const inPitch = !!el.closest(".pitch-slot-card, .squad-marker-empty");
    if (fs < 10 && !inPitch) issues.push(`tiny-${fs}px`);
    if (!issues.length) continue;
    seen.add(key);
    out.push({ issues: issues.join(","), text, where: where(el), fs });
  }
  return out;
}

const browser = await chromium.launch();
const lines = [];
let total = 0;

async function audit(page, label) {
  await page.waitForTimeout(400);
  const found = await page.evaluate(scan).catch(() => []);
  total += found.length;
  if (found.length) {
    lines.push(`\n## ${label} — ${found.length}`);
    for (const f of found) lines.push(`- [${f.issues}] "${f.text}"  (${f.where})`);
  }
  return found.length;
}

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
  const page = await context.newPage();
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(900);
    await audit(page, `${route} @${vp.name}`);
  }
  // Site menu (settings live here).
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Open menu" }).click().catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Mini Games/ }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await audit(page, `menu @${vp.name}`);
  if (vp.name === "320" || vp.name === "1280") await page.screenshot({ path: `e2e-shots/fit-menu-${vp.name}.png`, scale: "css" }).catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});

  // Classic pitch.
  await page.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Skip boost|Continue without boost/i }).first().click().catch(() => {});
  await page.getByRole("button", { name: /Auto.?fill squad/i }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await audit(page, `classic full squad @${vp.name}`);

  // Manager hub.
  await page.goto(`${BASE}/manager`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.getByRole("list", { name: "Clubs" }).getByRole("button").first().click().catch(() => {});
  await page.getByRole("button", { name: /Take charge of/ }).click().catch(() => {});
  await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  for (const tab of ["Match", "Team", "Table", "Club"]) {
    await page.getByRole("tab", { name: tab }).click().catch(() => {});
    await audit(page, `manager ${tab} @${vp.name}`);
  }
  await context.close();
}
await browser.close();

const report = `${total} text-fit finding(s)\n${lines.join("\n")}\n`;
writeFileSync("e2e-shots/text-fit.txt", report);
console.log(report.slice(0, 20000));
if (process.env.CI) console.log(`::notice title=Text-fit audit::${total} finding(s) — see ci-shots branch text-fit.txt`);
