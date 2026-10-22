/**
 * Hydration probe: replays the site crawl's first steps (home → /play) at phone widths against
 * `next dev` (full React error messages) and a prod server, and writes every page error and
 * console error to preview-shots/hydration-probe.txt. Diagnostic only.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const targets = (process.env.PROBE_TARGETS || "http://localhost:3000").split(",");
const OUT = "preview-shots";
fs.mkdirSync(OUT, { recursive: true });
const lines = [];
const browser = await chromium.launch();
for (const base of targets) {
  for (const width of (process.env.PROBE_WIDTHS || "375,320,375").split(",").map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: 812 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    let where = "";
    page.on("pageerror", (e) => lines.push(`[${base} @${width} ${where}] pageerror: ${String(e.stack || e).slice(0, 3000)}`));
    page.on("console", (m) => {
      if (m.type() === "error" || /hydrat/i.test(m.text())) lines.push(`[${base} @${width} ${where}] console.${m.type()}: ${m.text().slice(0, 4000)}`);
    });
    for (const route of ["/", "/play", "/play?era=1", "/play?daily=1", "/manager", "/play"]) {
      where = route;
      await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 120000 }).catch((e) => lines.push(`nav ${route}: ${e}`));
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1200);
      if (width === 375) await page.screenshot({ path: `${OUT}/hp-${width}-${route.replace(/[/?=]+/g, "_") || "home"}.png`, fullPage: true }).catch(() => {});
    }
    await context.close();
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/hydration-probe.txt`, lines.join("\n\n") || "no errors");
console.log(lines.join("\n\n") || "no errors");
