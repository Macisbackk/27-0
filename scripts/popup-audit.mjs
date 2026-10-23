/**
 * Popup audit: opens every popup we can reach on a 320×640 phone and a desktop, screenshots it
 * and checks the basics — it's a labelled dialog, focus moves into it, Escape closes it, it fits
 * the screen (or scrolls inside), nothing sits on top of it. Writes preview-shots/popup-audit.txt.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "preview-shots";
fs.mkdirSync(OUT, { recursive: true });
const lines = [];
const problems = [];
const browser = await chromium.launch();

async function audit(page, name, { escape = true, expectDialog = true } = {}) {
  await page.waitForTimeout(500);
  const dlg = page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').last();
  const found = await dlg.count();
  if (!found) {
    if (expectDialog) problems.push(`${name}: no visible role=dialog`);
    await page.screenshot({ path: `${OUT}/pp-${name}.png` }).catch(() => {});
    return;
  }
  const info = await dlg.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const label = el.getAttribute("aria-label") || (el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby"))?.textContent) || "";
    const focusInside = el.contains(document.activeElement);
    const scrollable = el.scrollHeight > el.clientHeight + 2 || [...el.querySelectorAll("*")].some((c) => c.scrollHeight > c.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(c).overflowY));
    // What's actually on top at the dialog's centre?
    const cx = Math.min(vw - 2, Math.max(1, r.left + r.width / 2));
    const cy = Math.min(vh - 2, Math.max(1, r.top + Math.min(r.height / 2, 60)));
    const topEl = document.elementFromPoint(cx, cy);
    const covered = topEl && !el.contains(topEl) && !topEl.contains(el);
    const pageScrolls = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const cs = getComputedStyle(el);
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      left: Math.round(r.left),
      right: Math.round(r.right),
      vw,
      vh,
      modal: el.getAttribute("aria-modal"),
      label: label.trim().slice(0, 60),
      focusInside,
      scrollable,
      covered: covered ? `${topEl.tagName.toLowerCase()}.${String(topEl.className).slice(0, 60)}` : null,
      pageScrolls,
      radius: cs.borderRadius,
    };
  });
  const issues = [];
  if (!info.label) issues.push("no accessible name");
  if (info.modal !== "true") issues.push("not aria-modal");
  if (!info.focusInside) issues.push("focus not moved into it");
  if (info.left < -1 || info.right > info.vw + 1) issues.push(`wider than the screen (${info.left}..${info.right} of ${info.vw})`);
  if ((info.top < -1 || info.bottom > info.vh + 1) && !info.scrollable) issues.push(`taller than the screen and doesn't scroll (${info.top}..${info.bottom} of ${info.vh})`);
  if (info.covered) issues.push(`something sits on top: ${info.covered}`);
  if (info.pageScrolls) issues.push("page scrolls sideways behind it");
  await page.screenshot({ path: `${OUT}/pp-${name}.png` });
  if (escape) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(450);
    if (await dlg.isVisible().catch(() => false)) issues.push("Escape doesn't close it");
  }
  lines.push(`${issues.length ? "✗" : "✓"} ${name}: ${info.w}×${info.h} "${info.label}"${issues.length ? " — " + issues.join("; ") : ""}`);
  for (const i of issues) problems.push(`${name}: ${i}`);
}

async function run(viewport, tag) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  const page = await context.newPage();
  const go = async (path) => {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
  };
  const tryStep = async (name, fn, opts) => {
    try {
      await fn();
      await audit(page, `${tag}-${name}`, opts);
    } catch (e) {
      problems.push(`${tag}-${name}: couldn't open (${String(e).split("\n")[0].slice(0, 120)})`);
    }
  };

  await tryStep("menu", async () => {
    await go("/");
    await page.getByRole("button", { name: "Open menu" }).click();
  });
  await tryStep("classic-how-to", async () => {
    await page.evaluate(() => localStorage.clear());
    await go("/play");
  }, { escape: false, expectDialog: false });
  await tryStep("classic-picker", async () => {
    await go("/play");
    await page.getByRole("button", { name: /let.?s play/i }).click({ timeout: 4000 }).catch(() => {});
    await page.getByRole("button", { name: /empty — tap to spin/ }).first().click({ timeout: 6000 });
    await page.getByRole("button", { name: /^Sign / }).first().waitFor({ timeout: 15000 });
  }, { escape: false });
  await tryStep("team-sheet-player", async () => {
    await page.getByRole("button", { name: /^Sign / }).first().click();
    await page.waitForTimeout(1500);
    // A filled slot reads "Position: Name, rated N".
    await page.getByRole("button", { name: /^[A-Za-z ]+: (?!empty).+/ }).first().click({ timeout: 6000 });
  });
  await tryStep("showcase-player", async () => {
    await go("/showcase");
    await page.locator("main button, main [role=button]").filter({ hasText: /\d{2}/ }).first().click({ timeout: 6000 });
  });
  await tryStep("manager-tutorial", async () => {
    await page.evaluate(() => localStorage.removeItem("27-0-career-v2"));
    await go("/manager");
    await page.getByRole("list", { name: "Clubs" }).getByRole("button").first().click();
    await page.getByRole("button", { name: /Take charge of/ }).click();
    await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).waitFor({ timeout: 8000 });
  });
  await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click().catch(() => {});
  await tryStep("manager-club-sheet", async () => {
    await page.getByRole("button", { name: "Skip pre-season" }).click({ timeout: 5000 });
    await page.getByRole("tab", { name: "Table" }).click();
    await page.locator("table tbody tr").nth(2).getByRole("button").first().click({ timeout: 5000 });
  });
  await tryStep("manager-team-slot", async () => {
    await page.getByRole("tab", { name: "Team" }).click();
    await page.getByRole("button", { name: /Shirt 1,/ }).click();
  });
  await tryStep("manager-legend-vault", async () => {
    await page.getByRole("tab", { name: "Club" }).click();
    await page.getByRole("button", { name: "Legend Vault" }).click();
  });
  await tryStep("manager-records", async () => {
    await page.getByRole("button", { name: "Records" }).first().click();
  });
  await tryStep("manager-end-career", async () => {
    await page.getByRole("button", { name: "Start a new career" }).click();
  });
  await tryStep("quiz-walk-away", async () => {
    await go("/mini-games/quiz");
    await page.getByRole("button", { name: /^(Play|Start|Play now|Start the quiz)/i }).first().click({ timeout: 5000 });
    await page.getByRole("button", { name: /walk away/i }).first().click({ timeout: 8000 });
  });
  await context.close();
}

await run({ width: 320, height: 640 }, "phone");
await run({ width: 1280, height: 800 }, "desktop");
await browser.close();
const report = `${lines.join("\n")}\n\n${problems.length} problem(s)\n${problems.map((p) => `- ${p}`).join("\n")}\n`;
fs.writeFileSync(`${OUT}/popup-audit.txt`, report);
console.log(report);
