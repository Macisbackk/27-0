// TEMPORARY: hunt the intermittent React #418 on /play. Not for merge.
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const LOADS = Number(process.env.LOADS || 30);
const LABEL = process.env.LABEL || "run";
const ROUTES = (process.env.ROUTES || "/play,/play?era=1,/play?daily=1").split(",");
const STATES = (process.env.STATES || "fresh,viaHome,crawl,corrupt,wrongShape").split(",");
const WIDTHS = [
  { name: "320", width: 320, height: 640, mobile: true },
  { name: "375", width: 375, height: 812, mobile: true },
  { name: "desktop", width: 1280, height: 800, mobile: false },
].filter((w) => !process.env.WIDTH || w.name === process.env.WIDTH);
const CRAWL = ["/", "/play", "/play?era=1", "/play?daily=1", "/manager", "/mini-games", "/store", "/profile", "/modes"];

mkdirSync("hyd-out", { recursive: true });
const summary = process.env.GITHUB_STEP_SUMMARY;
const out = (s) => {
  console.log(s);
  if (summary) appendFileSync(summary, s + "\n");
};

// Records every DOM mutation from the very first byte, and when the first error event fires.
const INIT = () => {
  const log = [];
  window.__hydLog = log;
  window.__hydErr = null;
  const desc = (n) => {
    if (!n) return "null";
    if (n.nodeType === 3) return `#text(${JSON.stringify((n.textContent || "").slice(0, 40))})`;
    if (n.nodeType === 8) return `<!--${(n.textContent || "").slice(0, 20)}-->`;
    if (n.nodeType !== 1) return `node${n.nodeType}`;
    const c = typeof n.className === "string" && n.className ? "." + n.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
    return `${n.tagName.toLowerCase()}${n.id ? "#" + n.id : ""}${c}`;
  };
  const path = (n) => {
    const p = [];
    while (n && n.nodeType === 1 && p.length < 5) {
      p.unshift(desc(n));
      n = n.parentNode;
    }
    return p.join(">");
  };
  new MutationObserver((recs) => {
    const t = Math.round(performance.now());
    for (const r of recs) {
      if (log.length > 300) return;
      if (r.target.nodeName === "HEAD" || (r.target.closest && r.target.closest("head"))) continue;
      log.push({
        t,
        type: r.type,
        target: path(r.target),
        attr: r.attributeName || undefined,
        added: [...r.addedNodes].slice(0, 4).map(desc),
        removed: [...r.removedNodes].slice(0, 4).map(desc),
      });
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  window.addEventListener("error", () => {
    if (window.__hydErr === null) window.__hydErr = Math.round(performance.now());
  });
};

async function corrupt(page, wrongShape) {
  const keys = await page.evaluate(() => Object.keys(localStorage));
  await page.evaluate(
    ([ks, ws]) => {
      for (const k of ks)
        localStorage.setItem(
          k,
          ws ? JSON.stringify({ wins: "lots", games: null, balance: -1, version: 999, items: "x" }) : k.includes("muted") ? "maybe" : "{{not json"
        );
    },
    [keys, wrongShape]
  );
}

const browser = await chromium.launch();
const totals = {};
const samples = [];
let loadsDone = 0;

for (const vp of WIDTHS) {
  for (const state of STATES) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
    await context.addInitScript(INIT);
    const page = await context.newPage();
    let where = "";
    let pending = [];
    page.on("pageerror", (e) => pending.push({ kind: "pageerror", text: e.message + "\n" + (e.stack || "").slice(0, 1500) }));
    page.on("console", (m) => {
      if (m.type() === "error" || /hydrat|didn't match|418/i.test(m.text())) pending.push({ kind: `console.${m.type()}`, text: m.text() });
    });
    // Seed storage like the e2e crawl does: visit the home page first.
    await page.goto(`${BASE}/`, { waitUntil: "load" }).catch(() => {});
    await page.waitForTimeout(1500);
    if (state === "corrupt") await corrupt(page, false);
    if (state === "wrongShape") await corrupt(page, true);
    for (const route of ROUTES) {
      const key = `${route} @${vp.name} ${state}`;
      totals[key] = totals[key] || { loads: 0, errors: 0 };
      for (let i = 0; i < LOADS; i++) {
        if (state === "fresh") await context.clearCookies();
        if (state === "fresh") await page.evaluate(() => localStorage.clear()).catch(() => {});
        if (state === "viaHome") {
          await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" }).catch(() => {});
          await page.waitForTimeout(300 + (i % 5) * 200);
        }
        if (state === "crawl") {
          // Same order/speed as e2e-site: previous route then this one, settling ~1.2s.
          const prev = CRAWL[(CRAWL.indexOf(route) - 1 + CRAWL.length) % CRAWL.length];
          await page.goto(`${BASE}${prev}`, { waitUntil: "domcontentloaded" }).catch(() => {});
          await page.waitForLoadState("networkidle").catch(() => {});
          await page.waitForTimeout(1200);
        }
        pending = [];
        where = key;
        let docBody = "";
        const onResp = async (r) => {
          if (r.request().resourceType() === "document") docBody = await r.text().catch(() => "");
        };
        page.on("response", onResp);
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }).catch((e) => pending.push({ kind: "nav", text: e.message }));
        await page.waitForLoadState("load").catch(() => {});
        await page.waitForTimeout(700);
        page.off("response", onResp);
        totals[key].loads++;
        loadsDone++;
        const hyd = pending.filter((p) => /418|hydrat|didn't match/i.test(p.text));
        if (hyd.length) {
          totals[key].errors++;
          const info = await page
            .evaluate(() => ({ err: window.__hydErr, log: window.__hydLog, sw: !!navigator.serviceWorker?.controller }))
            .catch(() => ({}));
          const storage = await page.evaluate(() => Object.keys(localStorage).join(",")).catch(() => "");
          const n = samples.length + 1;
          samples.push({ key, i, hyd, info, storage });
          if (n <= 6) {
            writeFileSync(`hyd-out/${LABEL}-${n}-server.html`, docBody);
            writeFileSync(`hyd-out/${LABEL}-${n}-client.html`, await page.content().catch(() => ""));
          }
        }
      }
    }
    await context.close();
  }
}
await browser.close();

out(`## Hydration hunt: ${LABEL}`);
out(`Loads: ${loadsDone}, with a hydration error: ${samples.length}`);
out("");
out("| scenario | loads | hydration errors |");
out("|---|---|---|");
for (const [k, v] of Object.entries(totals)) out(`| \`${k}\` | ${v.loads} | ${v.errors} |`);
out("");
for (const s of samples.slice(0, 5)) {
  out(`### ${s.key} (load #${s.i}) sw-controlled=${s.info?.sw} errAt=${s.info?.err}ms`);
  out("```");
  for (const h of s.hyd) out(`[${h.kind}] ${h.text.slice(0, 6000)}`);
  out("--- mutations (first 60) ---");
  for (const m of (s.info?.log || []).slice(0, 60))
    out(`${m.t}ms ${m.type} ${m.target}${m.attr ? " @" + m.attr : ""} +[${(m.added || []).join(", ")}] -[${(m.removed || []).join(", ")}]`);
  out(`storage keys: ${s.storage}`);
  out("```");
}
writeFileSync(`hyd-out/${LABEL}-samples.json`, JSON.stringify(samples, null, 1));
