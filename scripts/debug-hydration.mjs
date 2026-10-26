// TEMPORARY: hunt the intermittent React #418 on /play. Not for merge.
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const LABEL = process.env.LABEL || "run";
const HOME_PLAY_ITERS = Number(process.env.HOME_PLAY_ITERS || 40);
const CRAWL_ITERS = Number(process.env.CRAWL_ITERS || 10);
const DEADLINE = Date.now() + Number(process.env.BUDGET_MIN || 40) * 60_000;
const ROUTES = [
  "/", "/play", "/play?era=1", "/play?daily=1", "/play?challenge=broken-link.x", "/manager", "/mini-games", "/mini-games/quiz", "/mini-games/wordle", "/mini-games/grid",
  "/quiz", "/leaderboard", "/stats", "/profile", "/store", "/squad-book", "/records",
  "/modes", "/modes/past-dailies", "/play?oneclub=wigan-warriors", "/play?gauntlet=1",
  "/showcase", "/settings", "/login", "/auth/callback", "/auth/reset-password",
];
const VP = {
  "320": { width: 320, height: 640, mobile: true },
  "375": { width: 375, height: 812, mobile: true },
  desktop: { width: 1280, height: 800, mobile: false },
}[process.env.WIDTH || "375"];

mkdirSync("hyd-out", { recursive: true });
const out = (s) => {
  console.log(s);
  appendFileSync(`hyd-out/${LABEL}-summary.md`, s + "\n");
};

// Per-document: every DOM mutation from the first byte, plus errors tagged with the document's URL.
const INIT = () => {
  const log = [];
  window.__hydLog = log;
  const t0 = Date.now();
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
    const t = Date.now() - t0;
    if (document.readyState === "loading") return;
    for (const r of recs) {
      if (log.length > 600) return;
      if (r.target.nodeName === "HEAD" || (r.target.closest && r.target.closest("head"))) continue;
      if (r.type === "attributes" && r.target === document.documentElement && r.attributeName === "style") continue;
      log.push(
        `${t}ms ${r.type} ${path(r.target)}${r.attributeName ? " @" + r.attributeName : ""} +[${[...r.addedNodes].slice(0, 4).map(desc).join(", ")}] -[${[...r.removedNodes].slice(0, 4).map(desc).join(", ")}]`
      );
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  window.__hydMisLog = [];
  window.__hydMis = (fiber) => {
    if (window.__hydMisLog.length >= 2) return;
    const name = (f) => {
      if (!f) return "null";
      const t = f.type;
      const nm = typeof t === "string" ? t : t ? t.displayName || t.name || (t.$$typeof ? String(t.$$typeof) : typeof t) : `tag${f.tag}`;
      const pp = f.pendingProps || {};
      const cls = pp && typeof pp === "object" && typeof pp.className === "string" ? "." + pp.className.split(/\s+/).slice(0, 4).join(".") : "";
      const extra = pp && typeof pp === "object" ? ["id", "href", "aria-label", "role", "hidden"].filter((k) => pp[k] !== undefined).map((k) => `[${k}=${String(pp[k]).slice(0, 30)}]`).join("") : "";
      return `${nm}${cls}${extra}(tag${f.tag})`;
    };
    const lines = [];
    const t = fiber.type;
    lines.push(`MISMATCH FIBER: ${name(fiber)}`);
    if (typeof t === "function") lines.push(`fn source: ${t.toString().slice(0, 600)}`);
    const pp = fiber.pendingProps;
    lines.push(`props keys: ${pp && typeof pp === "object" ? Object.keys(pp).join(",") : JSON.stringify(pp)}`);
    if (pp && typeof pp === "object" && typeof pp.children === "string") lines.push(`children text: ${pp.children.slice(0, 100)}`);
    let f = fiber.return;
    const chain = [];
    for (let i = 0; f && i < 40; i++, f = f.return) {
      let nm = name(f);
      if (typeof f.type === "function" && !/^[A-Z]/.test(f.type.name || "")) nm += ` src{${f.type.toString().slice(0, 140)}}`;
      chain.push(nm);
    }
    lines.push(`return chain: ${chain.join("  <  ")}`);
    const sibs = [];
    for (let s = fiber.return && fiber.return.child; s && sibs.length < 12; s = s.sibling) sibs.push((s === fiber ? "*" : "") + name(s));
    lines.push(`siblings: ${sibs.join(" | ")}`);
    let h = fiber.return;
    while (h && !(h.stateNode && h.stateNode.nodeType === 1)) h = h.return;
    if (h) {
      const el = h.stateNode;
      lines.push(`host parent: ${name(h)}; its DOM children now: ${[...el.childNodes].slice(0, 15).map((n) => n.nodeType === 1 ? n.tagName.toLowerCase() + (n.className && typeof n.className === "string" ? "." + n.className.split(" ").slice(0, 3).join(".") : "") + (n.id ? "#" + n.id : "") : n.nodeType === 8 ? "<!--" + n.textContent.slice(0, 12) + "-->" : "#text:" + JSON.stringify(n.textContent.slice(0, 30))).join(" | ")}`);
    }
    window.__hydMisLog.push(lines.join("\n"));
  };
  window.addEventListener("error", (e) => {
    log.push(`${Date.now() - t0}ms ERROR ${e.message}`);
    const ctl = navigator.serviceWorker && navigator.serviceWorker.controller ? "sw" : "nosw";
    const stack = ((e.error && e.error.stack) || "").replace(/\|/g, "/").slice(0, 1500);
    const mis = (window.__hydMisLog || []).join("\n----\n").replace(/\|/g, "/");
    console.log(`HYDERR|${location.href}|${document.readyState} ${ctl}|${Date.now() - t0}ms|${e.message} STACK ${mis}|${JSON.stringify(log.slice(-40))}`);
  });
  document.addEventListener("visibilitychange", () => log.push(`${Date.now() - t0}ms visibility ${document.visibilityState}`));
  document.addEventListener("DOMContentLoaded", () => log.push(`${Date.now() - t0}ms DOMContentLoaded`));
  window.addEventListener("load", () => log.push(`${Date.now() - t0}ms load`));
  window.addEventListener("pagehide", () => log.push(`${Date.now() - t0}ms pagehide`));
};

const browser = await chromium.launch();
const samples = [];
const counts = {};
let loads = 0;

async function settle(page, ms) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

async function run(variant, routes, settleMs, extra = {}) {
  const context = await browser.newContext({ viewport: { width: VP.width, height: VP.height }, isMobile: VP.mobile, hasTouch: VP.mobile, ...extra });
  await context.addInitScript(INIT);
  const page = await context.newPage();
  let where = "";
  page.on("pageerror", (e) => {
    if (!/418|423|425|hydrat/i.test(e.message)) return;
    const k = `${variant} pageerror labelled ${where}`;
    counts[k] = (counts[k] || 0) + 1;
  });
  page.on("console", (m) => {
    const t = m.text();
    if (!t.startsWith("HYDERR|")) return;
    const [, href, ready, at, msg, ...rest] = t.split("|");
    if (!/418|423|425|hydrat/i.test(msg)) return;
    const k = `${variant} in-doc ${href.replace(BASE, "")} (labelled ${where})`;
    counts[k] = (counts[k] || 0) + 1;
    let log = [];
    try {
      log = JSON.parse(rest.join("|") || "[]");
    } catch {
      log = [rest.join("|").slice(0, 4000)];
    }
    samples.push({ variant, where, href, ready, at, msg, log });
  });
  for (const r of routes) {
    where = r;
    await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await settle(page, settleMs);
    loads++;
  }
  await context.close();
}

let crawls = 0;
for (let i = 0; i < HOME_PLAY_ITERS && Date.now() < DEADLINE; i++) {
  await run("home-play", ["/", "/play", "/play?era=1", "/play?daily=1"], 1200);
  await run("play-direct", ["/play", "/play?era=1", "/play", "/play?daily=1"], 1200);
}
await browser.close();

const pageErrors = Object.entries(counts)
  .filter(([k]) => k.includes("pageerror"))
  .reduce((a, [, v]) => a + v, 0);
out(`## Hydration hunt v2: ${LABEL}`);
out(`Loads: ${loads} (crawls: ${crawls}). Hydration pageerrors: ${pageErrors}`);
console.log(`::notice title=hyd ${LABEL}::loads ${loads}, pageerrors ${pageErrors}, samples ${samples.length}`);
out("");
for (const [k, v] of Object.entries(counts)) out(`- \`${k}\`: ${v}`);
out("");
for (const s of samples.slice(0, 8)) {
  out(`### in ${s.href} (labelled ${s.where}, ${s.variant}) readyState=${s.ready} at ${s.at}`);
  out("```");
  out(s.msg.replace(" STACK ", "\nSTACK "));
  for (const l of s.log) out(l);
  out("```");
}
writeFileSync(`hyd-out/${LABEL}-samples.json`, JSON.stringify(samples, null, 1));
