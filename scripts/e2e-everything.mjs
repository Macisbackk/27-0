/**
 * Whole-site stress test ("stress test every piece of the site"). Report-only by default.
 *
 * Part A — every route at 320×640 (touch), 390×844 (touch) and 1280×800, plus every tab, filter and
 * toggle on it. On each screen: no page errors / console errors (hydration #418/#423/#425 called
 * out), no sideways scroll, no element poking out of the viewport, no text clipped or spilling out of
 * a button, tap targets ≥ 40px on phones, nothing left under the fixed bottom nav / action bars at
 * the end of the page, and every visible button actually reachable (not covered by something else).
 *
 * Part B — abuse: double/triple taps on every primary button, back/forward and reload mid-run
 * (resume must work), rapid tab switching, rotating mid-flow, offline + reload, storage cleared
 * mid-flow, garbage / wrong-shaped values in every storage key, a very long coach name, extreme Club
 * Funds, full runs (Classic to the review and play-offs, Era, Daily) and a Manager season to the
 * review and into the summer.
 *
 * Writes preview-shots/everything-report.txt (+ ev-*.jpg screenshots of each failure).
 * Run against `next start` on :3000:  node scripts/e2e-everything.mjs
 * Env: E2E_BASE_URL, EV_OUT (output dir), EV_STRICT=1 (exit 1 on any problem), EV_ONLY=routes|flows.
 */
import fs from "node:fs";
import { skipWelcome } from "./e2e-skip-welcome.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.E2E_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.EV_OUT || "preview-shots";
const ONLY = process.env.EV_ONLY || "all";
fs.mkdirSync(OUT, { recursive: true });
const T0 = Date.now();
const timeout = 15_000;

const VIEWPORTS = [
  { name: "320", width: 320, height: 640, mobile: true },
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "1280", width: 1280, height: 800, mobile: false },
];

const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const ROUTES = [
  "/",
  "/play",
  "/play?era=1",
  "/play?bk=1",
  "/play?daily=1",
  "/play?daily=1&era=1",
  "/play?weekly=1",
  "/play?oneclub=wigan-warriors",
  "/play?gauntlet=1",
  "/play?gauntlet=1&era=1",
  `/play?archive=${yesterday}`,
  "/play?challenge=broken-link.x",
  "/modes",
  "/modes/past-dailies",
  "/store",
  "/leaderboard",
  "/profile",
  "/records",
  "/squad-book",
  "/showcase",
  "/settings",
  "/stats",
  "/mini-games",
  "/mini-games/quiz",
  "/mini-games/wordle",
  "/mini-games/grid",
  "/quiz",
  "/manager",
  "/login",
  "/privacy",
  "/delete-account",
  "/auth/reset-password",
  "/this-route-does-not-exist",
];

const IGNORED_CONSOLE = [
  /supabase/i, /Failed to fetch/i, /ERR_NAME_NOT_RESOLVED/i, /fetch failed/i, /Load failed/i, /net::ERR_/i,
  /_vercel\/insights/, /Failed to load resource/i, /\[career/, /leaderboard\].*failed/i, /\[auth\]/i,
  /sync failed/i, /cloud.*failed/i, /ERR_INTERNET_DISCONNECTED/i, /NetworkError/i,
];

/* ------------------------------------------------------------------ reporting */
/** msg → { kind, wheres:Set, shot } (one line per distinct problem, with where it was seen). */
const problems = new Map();
const notes = [];
let shots = 0;
const MAX_SHOTS = 160;
let where = "start";

function problem(kind, msg, at = where) {
  const key = `${kind}: ${msg}`;
  if (!problems.has(key)) problems.set(key, { kind, msg, wheres: new Set(), shot: null });
  problems.get(key).wheres.add(at);
  return problems.get(key);
}
const note = (m) => {
  notes.push(m);
  console.log(`✓ ${m}`);
};
const slug = (s) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 70).toLowerCase();
async function shot(page, name) {
  if (shots >= MAX_SHOTS) return null;
  shots++;
  const file = `ev-${String(shots).padStart(3, "0")}-${slug(name)}.jpg`;
  await page.screenshot({ path: `${OUT}/${file}`, type: "jpeg", quality: 55, scale: "css" }).catch(() => {});
  return file;
}
function writeReport(final = false) {
  const byKind = {};
  for (const p of problems.values()) (byKind[p.kind] ||= []).push(p);
  const lines = [
    `e2e-everything ${final ? "FINAL" : "(partial)"} — ${problems.size} distinct problem(s), ${Math.round((Date.now() - T0) / 1000)}s`,
    `base ${BASE}`,
    "",
  ];
  for (const [kind, list] of Object.entries(byKind).sort()) {
    lines.push(`## ${kind} (${list.length})`);
    for (const p of list) {
      const w = [...p.wheres];
      lines.push(`- ${p.msg}`);
      lines.push(`    at ${w.slice(0, 6).join(" | ")}${w.length > 6 ? ` (+${w.length - 6} more)` : ""}${p.shot ? `  [${p.shot}]` : ""}`);
    }
    lines.push("");
  }
  lines.push("## Checks run", ...notes.map((n) => `✓ ${n}`));
  fs.writeFileSync(`${OUT}/everything-report.txt`, `${lines.join("\n")}\n`);
}

/* ------------------------------------------------------------------ browser */
const browser = skipWelcome(await chromium.launch());

function unlockAllModes() {
  try {
    const key = "27-0-cosmetics-store";
    const ids = ["mode-one-club", "mode-gauntlet", "mode-past-dailies", "mode-ball-knower"];
    let state = {};
    try {
      state = JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch {
      state = {};
    }
    if (typeof state !== "object" || Array.isArray(state)) state = {};
    const owned = Array.isArray(state.owned) ? state.owned : [];
    if (ids.every((id) => owned.includes(id))) return;
    localStorage.setItem(key, JSON.stringify({ ...state, owned: [...new Set([...owned, ...ids])] }));
  } catch {
    /* storage blocked */
  }
}

async function newContext(vp, { unlock = true } = {}) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: 1,
  });
  if (unlock) await context.addInitScript(unlockAllModes);
  // No real network services in CI: fail Supabase fast instead of waiting on DNS.
  await context.route(/supabase\.co|_vercel\/insights/, (r) => r.abort()).catch(() => {});
  return context;
}

function wire(page) {
  page.on("crash", () => problem("page-crash", "the browser tab crashed (out of memory / renderer died)"));
  page.on("pageerror", (err) => {
    const m = err.message.split("\n")[0].slice(0, 220);
    const hyd = /#418|#423|#425|hydrat/i.test(m);
    const p = problem(hyd ? "hydration" : "page-error", m);
    if (!p.shot) void shot(page, `err-${where}`).then((f) => (p.shot = f));
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(t))) return;
    const hyd = /#418|#423|#425|hydrat/i.test(t);
    problem(hyd ? "hydration" : "console-error", t.split("\n")[0].slice(0, 220));
  });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 500 && url.startsWith(BASE)) problem("http", `HTTP ${res.status()} ${url.replace(BASE, "")}`);
  });
  return page;
}

async function settle(page, ms = 700) {
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(ms);
}
const visible = (loc) => loc.isVisible().catch(() => false);
const btn = (page, name) => page.getByRole("button", { name }).first();

async function crashed(page) {
  return visible(page.getByText(/Something went wrong|Application error|client-side exception|career hit a problem/i).first());
}

/** Click the first visible, enabled button whose accessible name matches one of the patterns. */
async function tapFirst(page, patterns, { force = false } = {}) {
  for (const re of patterns) {
    const b = page.getByRole("button", { name: re });
    const n = Math.min(await b.count().catch(() => 0), 4);
    for (let i = 0; i < n; i++) {
      const one = b.nth(i);
      if ((await one.isVisible().catch(() => false)) && (await one.isEnabled().catch(() => false))) {
        await one.click({ timeout: 4000, force }).catch(() => {});
        return re.source;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ the in-page audit */
/**
 * Runs inside the page. Scrolls top → bottom; returns layout problems. Pure DOM, no app knowledge
 * beyond the generic bottom-bar selectors.
 */
async function inPageAudit({ mobile }) {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const out = [];
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const desc = (el) => {
    if (!el || el.nodeType !== 1) return String(el);
    const label = el.getAttribute("aria-label") || el.getAttribute("title") || (el.innerText || el.value || "").trim().replace(/\s+/g, " ");
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""}>${label ? ` "${label.slice(0, 40)}"` : ""}`;
  };
  const isVis = (el) => {
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  };
  const srOnly = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.clip && cs.clip !== "auto") return true;
      if (cs.clipPath && cs.clipPath !== "none" && /inset\(50%|circle\(0/.test(cs.clipPath)) return true;
      const r = n.getBoundingClientRect();
      if (cs.position === "absolute" && r.width <= 1 && r.height <= 1) return true;
    }
    return false;
  };
  const inert = (el) => !!el.closest("[inert], [aria-hidden='true']");
  const de = document.documentElement;

  // 1) Sideways scroll.
  if (de.scrollWidth > de.clientWidth + 1) out.push({ kind: "overflow", msg: `page scrolls sideways (${de.scrollWidth}px content in ${de.clientWidth}px)` });

  // An open modal: only its contents are expected to be reachable.
  // (Size only: a dialog still fading in counts.)
  const modal = [...document.querySelectorAll("[role='dialog'], [role='alertdialog'], dialog[open]")].find((d) => {
    const r = d.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(d).display !== "none" && (d.getAttribute("aria-modal") === "true" || d.tagName === "DIALOG");
  });
  const scope = modal || document.body;

  const INTERACTIVE = "a[href], button, input:not([type='hidden']), select, textarea, [role='button'], [role='tab'], [role='switch'], [role='checkbox'], [role='radio'], [role='link'], [role='menuitem'], [role='option'], summary";
  const all = [...scope.querySelectorAll(INTERACTIVE)].filter((el) => !inert(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true");

  // 2) Elements poking out of the viewport (outermost only, ignoring ones clipped by a scroller).
  const reportedWide = [];
  const wide = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (wide.length >= 6) break;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (!(r.right > vw + 1.5 || r.left < -1.5)) continue;
    if (r.left >= vw || r.right <= 0) continue; // fully off-canvas (drawers); sideways scroll catches real ones
    if (reportedWide.some((p) => p.contains(el))) continue;
    if (!isVis(el) || srOnly(el)) continue;
    let clipped = false;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(hidden|clip|auto|scroll)/.test(cs.overflowX) || /(hidden|clip)/.test(cs.overflow)) {
        const pr = p.getBoundingClientRect();
        if (pr.right <= vw + 1.5 && pr.left >= -1.5) clipped = true;
        break;
      }
      if (cs.position === "fixed") break;
    }
    if (clipped) continue;
    reportedWide.push(el);
    wide.push(`${desc(el)} spans ${Math.round(r.left)}…${Math.round(r.right)}px`);
  }
  for (const w of wide) out.push({ kind: "too-wide", msg: `wider than the ${vw}px screen: ${w}` });

  // 3) Text clipped in / spilling out of buttons.
  const BUTTONISH = "button, [role='button'], [role='tab'], a.btn-press, a[class*='rounded']";
  let clippedN = 0;
  const truncated = [];
  for (const b of scope.querySelectorAll(BUTTONISH)) {
    if (clippedN >= 8) break;
    if (!isVis(b) || inert(b)) continue;
    const br = b.getBoundingClientRect();
    if (br.right < 0 || br.left > vw) continue;
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    let bad = null;
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent.trim() || !t.parentElement || !isVis(t.parentElement) || srOnly(t.parentElement)) continue;
      // Deliberate multi-line clamps (line-clamp-2) are fine.
      if (t.parentElement.closest("[class*='line-clamp']")) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      for (const rr of range.getClientRects()) {
        if (rr.width < 1) continue;
        const dx = Math.max(br.left - rr.left, rr.right - br.right);
        const dy = Math.max(br.top - rr.top, rr.bottom - br.bottom);
        if (dx > 2 || dy > 3) {
          bad = `"${t.textContent.trim().slice(0, 40)}" overflows by ${Math.round(Math.max(dx, dy))}px`;
          break;
        }
      }
      // Ellipsis inside the button (text cut short).
      const pe = t.parentElement;
      if (!bad && getComputedStyle(pe).textOverflow === "ellipsis" && pe.scrollWidth > pe.clientWidth + 1) {
        truncated.push(`${desc(b)}: "${t.textContent.trim().slice(0, 40)}"`);
        bad = "truncated";
      }
      if (bad) break;
    }
    if (bad && bad !== "truncated") {
      clippedN++;
      out.push({ kind: "clipped-text", msg: `${desc(b)}: ${bad}` });
    }
  }

  if (truncated.length) out.push({ kind: "truncated", msg: `${truncated.length} button label(s) cut short with …, e.g. ${truncated[0]}` });

  // 4) Tap targets on phones.
  if (mobile) {
    const small = [];
    let tableSmall = 0;
    for (const el of all) {
      if (!isVis(el) || srOnly(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width >= 39.5 && r.height >= 39.5) continue; // sub-pixel rounding of a 40px box
      const cs = getComputedStyle(el);
      // Inline links inside running text are exempt (WCAG 2.5.8 inline exception).
      // (Also club names you can tap inside a sentence, e.g. "Leeds want Smith and offer…".)
      if (/^inline/.test(cs.display) && el.parentElement && /\S/.test((el.parentElement.textContent || "").replace(el.textContent || "", "")) && r.height < 30) continue;
      // A checkbox/radio inside a big enough label is fine.
      if (el.tagName === "INPUT" && /checkbox|radio|range/.test(el.type)) {
        const lab = el.closest("label") || (el.id && document.querySelector(`label[for='${el.id}']`));
        if (lab && lab.getBoundingClientRect().height >= 40) continue;
      }
      // Dense data tables (league tables, stat grids) are reported separately, not per cell.
      if (el.closest("table, [role='table'], [role='grid']")) {
        tableSmall++;
        continue;
      }
      // Nested inside a bigger tappable (row buttons etc.).
      const host = el.parentElement?.closest("button, a[href], label, [role='button']");
      if (host && host.getBoundingClientRect().height >= 40 && host.getBoundingClientRect().width >= 40) continue;
      small.push(`${desc(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    for (const s of small.slice(0, 10)) out.push({ kind: "tap-target", msg: `under 40px: ${s}` });
    if (small.length > 10) out.push({ kind: "tap-target", msg: `…and ${small.length - 10} more small tap targets` });
    if (tableSmall) out.push({ kind: "tap-target-table", msg: `${tableSmall} small tap target(s) inside data tables` });
  }

  // 5) Covered buttons: walk the page; a control that was on screen but never the top element at
  //    its centre can't be tapped.
  const state = new Map();
  const maxY = Math.max(0, de.scrollHeight - vh);
  const steps = [];
  for (let y = 0; y < maxY; y += Math.max(120, Math.floor(vh * 0.4))) steps.push(y);
  steps.push(maxY);
  const startY = window.scrollY;
  for (const y of steps.slice(0, 40)) {
    window.scrollTo(0, y);
    await frame();
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx < 1 || cx > vw - 1 || cy < 1 || cy > vh - 1) continue;
      if (!isVis(el) || srOnly(el)) continue;
      const s = state.get(el) || { seen: false, ok: false, by: null };
      s.seen = true;
      if (!s.ok) {
        const hit = document.elementFromPoint(cx, cy);
        if (hit && (el === hit || el.contains(hit) || hit.contains(el) || (el.tagName === "INPUT" && hit.closest("label")?.contains(el)) || (el.labels && [...el.labels].some((l) => l.contains(hit))))) s.ok = true;
        else s.by = hit;
      }
      state.set(el, s);
    }
  }
  // 6) Content left under the fixed bottom bars at the very end of the page.
  window.scrollTo(0, maxY);
  await frame();
  const bars = [...document.querySelectorAll("body *")].filter((el) => {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") return false;
    if (!isVis(el)) return false;
    const r = el.getBoundingClientRect();
    return r.bottom >= vh - 3 && r.top > vh * 0.45 && r.width >= vw * 0.6 && r.height < vh * 0.45;
  });
  if (bars.length) {
    const barTop = Math.min(...bars.map((b) => b.getBoundingClientRect().top));
    const hidden = [];
    for (const el of (modal || document.querySelector("main") || document.body).querySelectorAll("*")) {
      if (hidden.length >= 3) break;
      if (bars.some((b) => b.contains(el) || el.contains(b))) continue;
      if (el.children.length && !el.matches(INTERACTIVE)) continue; // leaves + controls only
      if (!(el.textContent || "").trim() && !el.matches(INTERACTIVE)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 2 || r.top >= vh || r.bottom <= barTop + 3) continue;
      if (!isVis(el) || srOnly(el) || inert(el)) continue;
      let fixedOrScroller = false;
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.position === "fixed" || (p !== el && /(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 2)) {
          fixedOrScroller = true;
          break;
        }
      }
      if (fixedOrScroller) continue;
      hidden.push(`${desc(el)} (${Math.round(r.bottom - barTop)}px under ${desc(bars.find((b) => b.getBoundingClientRect().top === barTop))})`);
    }
    for (const h of hidden) out.push({ kind: "under-bottom-bar", msg: `left under a fixed bar at the end of the page: ${h}` });
  }
  // Second chance for anything never hit: scroll it into view (inner scrollers like the menu).
  for (const [el, s] of state) {
    if (!s.seen || s.ok || !el.isConnected) continue;
    el.scrollIntoView({ block: "center", inline: "nearest" });
    await frame();
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit && (el === hit || el.contains(hit) || hit.contains(el))) s.ok = true;
    else s.by = hit;
  }
  let coveredN = 0;
  for (const [el, s] of state) {
    if (coveredN >= 6) break;
    if (!s.seen || s.ok) continue;
    if (!el.isConnected) continue;
    coveredN++;
    out.push({ kind: "covered", msg: `can't be tapped (covered by ${desc(s.by)}): ${desc(el)}` });
  }
  window.scrollTo(0, startY);
  return out;
}

async function audit(page, label, vp) {
  where = label;
  let res = [];
  try {
    res = await page.evaluate(inPageAudit, { mobile: vp.mobile });
  } catch (e) {
    problem("harness", `audit failed: ${String(e).split("\n")[0].slice(0, 160)}`);
    return;
  }
  if (await crashed(page)) res.push({ kind: "crash", msg: "error screen shown" });
  let file = null;
  for (const r of res) {
    const p = problem(r.kind, r.msg, label);
    if (!p.shot && r.kind !== "tap-target") {
      file ||= await shot(page, `${r.kind}-${label}`);
      p.shot = file;
    }
  }
}

/* ------------------------------------------------------------------ Part A: every route */
async function routeExtras(page, route, vp, label) {
  // Every tab on the page (store, leaderboard, showcase, manager picker, login…).
  const tabs = page.getByRole("tab");
  const n = Math.min(await tabs.count().catch(() => 0), 12);
  for (let i = 0; i < n; i++) {
    const t = tabs.nth(i);
    if (!(await visible(t))) continue;
    const name = ((await t.innerText().catch(() => "")) || `tab${i}`).trim().replace(/\s+/g, " ").slice(0, 24);
    await t.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(350);
    await audit(page, `${label} [tab ${name}]`, vp);
  }
  if (route === "/showcase") {
    for (const name of ["Historic", "Current"]) {
      await page.getByRole("button", { name, exact: true }).click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    if (await tapFirst(page, [/^Filters/])) {
      await page.waitForTimeout(400);
      await audit(page, `${label} [filters]`, vp);
      // Flip every filter chip once.
      const chips = page.locator("[role='dialog'] button[aria-pressed], [aria-pressed]");
      const c = Math.min(await chips.count().catch(() => 0), 14);
      for (let i = 0; i < c; i++) await chips.nth(i).click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(300);
      await audit(page, `${label} [filters flipped]`, vp);
      await page.keyboard.press("Escape").catch(() => {});
    }
    await page.locator(".showcase-row__button").first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
    await audit(page, `${label} [player card]`, vp);
    await page.keyboard.press("Escape").catch(() => {});
  }
  if (route === "/settings") {
    const toggles = page.locator("[role='switch'], input[type='checkbox']");
    const c = Math.min(await toggles.count().catch(() => 0), 12);
    for (let i = 0; i < c; i++) {
      const tg = toggles.nth(i);
      if (!(await visible(tg))) continue;
      await tg.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(200);
      await tg.click({ timeout: 2000 }).catch(() => {});
    }
    await audit(page, `${label} [toggled]`, vp);
  }
  if (route.startsWith("/play")) {
    // Past the pre-run screen (boost / how to play) onto the pitch.
    const t = await tapFirst(page, [/Let.?s play/i, /Skip boost|Continue without boost/i, /^Start/i, /^Play$/i]);
    if (t) {
      await page.waitForTimeout(700);
      await tapFirst(page, [/Skip boost|Continue without boost/i]);
      await page.waitForTimeout(500);
      await audit(page, `${label} [pitch]`, vp);
    }
  }
  if (route === "/manager") {
    const club = page.getByRole("list", { name: "Clubs" }).getByRole("button").first();
    if (await visible(club)) {
      await club.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(400);
      await audit(page, `${label} [club picked]`, vp);
    }
  }
  if (route === "/") {
    if (await tapFirst(page, [/open menu/i])) {
      await page.waitForTimeout(500);
      await audit(page, `${label} [menu]`, vp);
      await page.keyboard.press("Escape").catch(() => {});
    }
  }
}

if (ONLY === "all" || ONLY === "routes") {
  for (const vp of VIEWPORTS) {
    const context = await newContext(vp);
    const page = wire(await context.newPage());
    for (const route of ROUTES) {
      const label = `${route} @${vp.name}`;
      where = label;
      try {
        const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (res && res.status() >= 500) problem("http", `status ${res.status()}`, label);
        await settle(page, 900);
        await audit(page, label, vp);
        await routeExtras(page, route, vp, label);
      } catch (e) {
        problem("harness", `route visit failed: ${String(e).split("\n")[0].slice(0, 160)}`, label);
      }
    }
    await context.close();
    note(`Audited ${ROUTES.length} routes (+ tabs, filters, toggles) @${vp.name}`);
    writeReport();
  }
}

/* ------------------------------------------------------------------ Part B: flows */
const PHONE = VIEWPORTS[1];
const SMALL = VIEWPORTS[0];
const filled = (page) => page.locator('[aria-label*="rated"]').count().catch(() => -1);

/** Get onto the Classic pitch (past boost / how-to screens). */
async function toPitch(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await settle(page, 900);
  for (let i = 0; i < 3; i++) {
    const t = await tapFirst(page, [/Let.?s play/i, /Skip boost|Continue without boost/i, /Start (a )?new run/i, /^Start$/i]);
    if (!t) break;
    await page.waitForTimeout(600);
  }
}

/** One Classic signing: Spin → (skip reel) → See players → Sign → confirm placement. Returns true if a player was signed. */
async function signOne(page, { abuse = false } = {}) {
  const before = await filled(page);
  const spin = page.getByRole("button", { name: /^Spin$|: empty — tap to spin$/ }).first();
  if (!(await visible(spin))) return false;
  if (abuse) {
    for (let i = 0; i < 3; i++) await spin.click({ force: true, noWaitAfter: true, timeout: 1500 }).catch(() => {});
  } else await spin.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole("dialog", { name: "Recruitment spin" }).click({ timeout: 2500 }).catch(() => {});
  const see = page.getByRole("button", { name: "See players" });
  await see.waitFor({ timeout: 5000 }).catch(() => {});
  if (await visible(see)) {
    if (abuse) for (let i = 0; i < 3; i++) await see.click({ force: true, noWaitAfter: true, timeout: 1500 }).catch(() => {});
    else await see.click({ timeout: 4000 }).catch(() => {});
  }
  const sign = page.getByRole("button", { name: /^Sign / }).first();
  await sign.waitFor({ timeout: 6000 }).catch(() => {});
  if (!(await visible(sign))) return false;
  if (abuse) for (let i = 0; i < 3; i++) await sign.click({ force: true, noWaitAfter: true, timeout: 1500 }).catch(() => {});
  else await sign.click({ timeout: 4000 }).catch(() => {});
  await page.getByRole("button", { name: /Confirm Placement/i }).first().click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(500);
  const after = await filled(page);
  if (abuse && after - before > 1) problem("double-action", `triple taps on Spin / See players / Sign signed ${after - before} players`);
  return after > before;
}

const RUN_PATTERNS = [
  /Let.?s play/i, /Skip boost|Continue without boost/i, /Auto.?fill squad/i, /Kick off the season|Simulate season/i,
  /Push for the top two/i, /Rest the stars/i, /Chase the points difference/i, /Keep going|Play it safe|Go for it/i,
  /^Skip to full time/i, /^Skip$/i, /^Play-offs$|Continue to play-offs/i, /Sim(ulate)? (the )?(play-?offs|final|next|round|tie)/i,
  /Play (the )?(semi|final|grand final|next tie|tie)/i, /^Continue$/i, /^Next/i, /View (season )?review/i, /See (your |the )?review/i, /^Finish/i,
];

/** Drive a Classic-style run to its end. Returns { reviewed, playoffs, taps }. */
async function playRun(page, route, label, { maxSteps = 90 } = {}) {
  where = label;
  await toPitch(page, route);
  const seen = [];
  let reviewed = false;
  let playoffs = false;
  let done = false;
  for (let i = 0; i < maxSteps && !done; i++) {
    if (await crashed(page)) {
      problem("crash", "error screen during a run", label);
      break;
    }
    const text = await page.locator("main").innerText().catch(() => "");
    if (/Regular Season Record|League Position|Season review|Season result/i.test(text)) reviewed = true;
    if (/Play-off Summary|Play-off Bracket|Play-offs done|Grand Final/i.test(text)) playoffs = true;
    if (reviewed && (await visible(btn(page, /^Play again$/))) && !(await visible(btn(page, /^Play-offs$|Continue to play-offs/i)))) {
      done = true;
      break;
    }
    let t = await tapFirst(page, RUN_PATTERNS);
    // Classic without Auto-fill: sign the squad by hand (Spin → See players → Sign).
    if (!t && (await signOne(page))) t = "Spin+Sign";
    if (t) seen.push(t.replace(/\\|\^|\$|\/i/g, "").slice(0, 24));
    await page.waitForTimeout(t ? 650 : 1200);
  }
  return { reviewed, playoffs, done, taps: seen };
}

async function flow(name, fn, vp = PHONE) {
  where = name;
  const context = await newContext(vp);
  const page = wire(await context.newPage());
  const t = Date.now();
  try {
    await fn(page, context);
  } catch (e) {
    const p = problem("flow-stopped", `${name} (at ${where}): ${String(e).split("\n")[0].slice(0, 200)}`, name);
    p.shot ||= await shot(page, `stopped-${name}`);
  }
  await context.close().catch(() => {});
  console.log(`  (${name}: ${Math.round((Date.now() - t) / 1000)}s)`);
  writeReport();
}

if (ONLY === "all" || ONLY === "flows") {
  /* --- Full Classic run to the review + play-offs, auditing each stage. */
  await flow("Classic full run", async (page) => {
    await toPitch(page, "/play");
    // Three hand signings with triple taps on every primary button.
    let signed = 0;
    for (let i = 0; i < 3; i++) if (await signOne(page, { abuse: true })) signed++;
    if (signed < 3) problem("flow", `Classic: only ${signed}/3 hand signings landed`, "Classic full run");
    await audit(page, "Classic after 3 signings @390", PHONE);
    const r = await playRun(page, "/play", "Classic full run");
    await audit(page, "Classic end of run @390", PHONE);
    if (!r.reviewed) problem("flow", `Classic never reached the season review (taps: ${r.taps.slice(0, 14).join(" › ")})`, "Classic full run").shot ||= await shot(page, "classic-no-review");
    else note(`Classic: run to the review${r.playoffs ? " and play-offs" : ""} (${r.taps.length} taps)`);
  });

  /* --- Era, Daily, Ball Knower, One-Club, Gauntlet runs. */
  for (const [name, route] of [
    ["Era run", "/play?era=1"],
    ["Daily run", "/play?daily=1"],
    ["Ball Knower run", "/play?bk=1"],
    ["One-Club run", "/play?oneclub=wigan-warriors"],
    ["Gauntlet run", "/play?gauntlet=1"],
  ]) {
    await flow(name, async (page) => {
      const r = await playRun(page, route, name);
      await audit(page, `${name} end @390`, PHONE);
      if (!r.reviewed && !/Gauntlet/.test(name)) problem("flow", `${name}: never reached a season review (taps: ${r.taps.slice(0, 14).join(" › ")})`, name).shot ||= await shot(page, `${name}-no-review`);
      else note(`${name}: played to the end (${r.taps.length} taps)`);
    });
  }

  /* --- Reload, back/forward, rotate, offline, storage cleared mid-run. */
  await flow("Classic resume + navigation abuse", async (page, context) => {
    await toPitch(page, "/play");
    await signOne(page);
    await signOne(page);
    const n0 = await filled(page);
    // Reload mid-run.
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page, 900);
    await tapFirst(page, [/Resume|Continue (your|the) run|Carry on/i]);
    await page.waitForTimeout(500);
    const n1 = await filled(page);
    if (n1 < n0) problem("resume", `reload mid-run lost signings (${n0} → ${n1})`).shot ||= await shot(page, "reload-lost");
    else note(`Classic: reload mid-run kept ${n1} signings`);
    // Back / forward.
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await settle(page, 500);
    await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
    await settle(page, 900);
    await tapFirst(page, [/Resume|Continue (your|the) run|Carry on/i]);
    const n2 = await filled(page);
    if (n2 < n0) problem("resume", `back button mid-run lost signings (${n0} → ${n2})`).shot ||= await shot(page, "back-lost");
    await page.goForward().catch(() => {});
    await page.goBack().catch(() => {});
    await settle(page, 600);
    // Back while the picker is open (should close it or leave the run intact).
    const spin = page.getByRole("button", { name: /^Spin$/ }).first();
    if (await visible(spin)) {
      await spin.click().catch(() => {});
      await page.getByRole("dialog", { name: "Recruitment spin" }).click({ timeout: 2500 }).catch(() => {});
      await page.getByRole("button", { name: "See players" }).click({ timeout: 5000 }).catch(() => {});
      // Rotate mid-flow (picker open).
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(500);
      await audit(page, "Classic picker rotated 844×390", { mobile: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(400);
      await audit(page, "Classic picker rotated back @390", PHONE);
      await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
      await settle(page, 600);
      if (await crashed(page)) problem("crash", "back with the picker open crashed");
    }
    note("Classic: back/forward, rotate with the picker open");
    // Offline: reload, then back online.
    await page.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
    await settle(page, 800);
    await context.setOffline(true);
    const offlineOk = await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 }).then(() => true, () => false);
    await page.waitForTimeout(800);
    if (offlineOk && (await crashed(page))) problem("crash", "offline reload shows the error screen");
    await shot(page, "offline-reload");
    await context.setOffline(false);
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page, 900);
    await tapFirst(page, [/Resume|Continue (your|the) run|Carry on/i]);
    if (await crashed(page)) problem("crash", "back online after an offline reload shows the error screen");
    note(`Offline reload (${offlineOk ? "page served" : "browser offline page"}), then back online`);
    // Storage cleared mid-run, then keep playing and reload.
    await toPitch(page, "/play");
    await signOne(page);
    await page.evaluate(() => localStorage.clear());
    await signOne(page);
    await tapFirst(page, [/Auto.?fill squad/i]);
    await page.waitForTimeout(600);
    if (await crashed(page)) problem("crash", "Classic crashed after storage was cleared mid-run").shot ||= await shot(page, "cleared-mid-run");
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page, 900);
    if (await crashed(page)) problem("crash", "Classic reload after storage cleared shows the error screen");
    note("Classic: storage cleared mid-run, kept playing, reloaded");
  });

  /* --- Two tabs on one run. */
  await flow("Classic two tabs", async (page, context) => {
    await toPitch(page, "/play");
    await signOne(page);
    const b = wire(await context.newPage());
    await b.goto(`${BASE}/play`, { waitUntil: "domcontentloaded" });
    await settle(b, 900);
    await tapFirst(b, [/Resume|Continue (your|the) run|Carry on/i]);
    await signOne(b);
    await signOne(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page, 900);
    if (await crashed(page)) problem("crash", "two tabs on one Classic run crashed");
    await b.close();
    note("Classic: two tabs signing on one run");
  });

  /* --- Rapid tab switching. */
  await flow("Rapid tab switching", async (page) => {
    for (const route of ["/store", "/leaderboard", "/login", "/showcase"]) {
      where = `rapid tabs ${route}`;
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await settle(page, 700);
      const tabs = page.getByRole("tab");
      const n = await tabs.count();
      for (let i = 0; i < 30 && n; i++) await tabs.nth(i % n).click({ force: true, noWaitAfter: true, timeout: 800 }).catch(() => {});
      await page.waitForTimeout(500);
      await audit(page, `rapid tabs ${route} @320`, SMALL);
    }
    note("Rapid tab switching on Store, Leaderboard, Login, Showcase");
  }, SMALL);

  /* --- Store: double-tap Buy / Use with plenty of funds. */
  await flow("Store double taps", async (page) => {
    await page.goto(`${BASE}/store`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("27-0-club-funds", JSON.stringify({ balance: 50_000_000, totalEarned: 50_000_000, paidRunIds: ["starter-grant"] })));
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page, 800);
    const balance = () => page.evaluate(() => JSON.parse(localStorage.getItem("27-0-club-funds") || "{}").balance ?? 0);
    const tabs = await page.getByRole("tab").allInnerTexts().catch(() => []);
    for (const tab of tabs) {
      await page.getByRole("tab", { name: tab.trim() }).first().click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
      const buy = page.getByRole("button", { name: /£[\d.]+m|^Buy/ }).first();
      if (!(await visible(buy)) || !(await buy.isEnabled().catch(() => false))) continue;
      const label = (await buy.innerText().catch(() => "")).trim();
      const m = /£([\d.]+)(m|k)/.exec(label);
      const b0 = await balance();
      // One element, three taps (a locator would move on to the next item's Buy button).
      const handle = await buy.elementHandle();
      await handle.evaluate((el) => {
        el.click();
        el.click();
        el.click();
      });
      await page.waitForTimeout(500);
      // A confirm step, if any.
      await tapFirst(page, [/^Confirm|^Buy it|^Yes/i]);
      await page.waitForTimeout(400);
      const spent = b0 - (await balance());
      if (m && spent > Number(m[1]) * (m[2] === "m" ? 1_000_000 : 1_000) + 1) problem("double-action", `Store ${tab.trim()}: triple tap on "${label}" spent £${spent.toLocaleString()}`);
      const use = page.getByRole("button", { name: /^(Use|Equip|On)$/ }).first();
      for (let i = 0; i < 5; i++) await use.click({ force: true, noWaitAfter: true, timeout: 800 }).catch(() => {});
      await page.waitForTimeout(300);
      await audit(page, `Store ${tab.trim()} after buy @390`, PHONE);
    }
    note(`Store: triple taps on Buy / Use across ${tabs.length} tabs`);
  });

  /* --- Extreme Club Funds and a very long coach name. */
  await flow("Extreme values", async (page) => {
    const LONG = "Maximilian Featherstonehaugh-Wolfeschlegelsteinhausenbergerdorff the Third";
    const vals = [
      ["huge funds", { balance: 999_999_999_999, totalEarned: 999_999_999_999, paidRunIds: [] }],
      ["negative funds", { balance: -123_456_789, totalEarned: 0, paidRunIds: [] }],
      ["string funds", { balance: "lots", totalEarned: null, paidRunIds: "x" }],
    ];
    for (const [label, v] of vals) {
      for (const vp of [SMALL, VIEWPORTS[2]]) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
        await page.evaluate(([val, name]) => {
          localStorage.setItem("27-0-club-funds", JSON.stringify(val));
          localStorage.setItem("27-0-username", name);
        }, [v, LONG]);
        for (const route of ["/", "/store", "/profile", "/leaderboard", "/settings", "/play"]) {
          await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
          await settle(page, 700);
          await audit(page, `${label} + long name ${route} @${vp.name}`, vp);
        }
      }
    }
    // Long name typed into Manager Mode.
    await page.setViewportSize({ width: 320, height: 640 });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE}/manager`, { waitUntil: "domcontentloaded" });
    await settle(page, 800);
    await page.getByRole("list", { name: "Clubs" }).getByRole("button").first().click({ timeout }).catch(() => {});
    const nameInput = page.getByPlaceholder(/Your name/i);
    if (await visible(nameInput)) {
      await nameInput.fill(LONG + LONG);
      const val = await nameInput.inputValue();
      note(`Manager name box kept ${val.length} characters`);
      await audit(page, "Manager long coach name @320", SMALL);
      await btn(page, /Take charge of/).click({ timeout }).catch(() => {});
      await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
      await settle(page, 600);
      await audit(page, "Manager hub with long coach name @320", SMALL);
      for (const t of ["Team", "Table", "Club", "Match"]) {
        await page.getByRole("tab", { name: t }).click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(300);
        await audit(page, `Manager ${t} tab (long name) @320`, SMALL);
      }
    }
    note("Extreme Club Funds (huge / negative / garbage) and a very long coach name");
  }, SMALL);

  /* --- Manager: a full season to the review, into the summer and the next pre-season, at 320. */
  await flow("Manager season", async (page) => {
    const SAVE = "27-0-career-v2-save";
    const save = () => page.evaluate((k) => {
      try {
        return JSON.parse(localStorage.getItem(k) || "null");
      } catch {
        return null;
      }
    }, SAVE);
    await page.goto(`${BASE}/manager`, { waitUntil: "domcontentloaded" });
    await settle(page, 800);
    await page.getByRole("list", { name: "Clubs" }).getByRole("button").nth(2).click({ timeout });
    await page.getByPlaceholder(/Your name/i).fill("Stress Tester").catch(() => {});
    await btn(page, /Take charge of/).dblclick({ timeout });
    await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
    await settle(page, 600);
    await audit(page, "Manager pre-season @320", SMALL);
    const pre = page.getByRole("region", { name: "Pre-season friendlies" });
    if (await visible(pre)) await pre.getByRole("button", { name: /^Play / }).first().dblclick().catch(() => {});
    await btn(page, "Play match").waitFor({ timeout }).catch(() => {});
    for (const t of ["Team", "Table", "Club", "Match"]) {
      await page.getByRole("tab", { name: t }).click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
      await audit(page, `Manager ${t} tab @320`, SMALL);
      // Sub-tabs.
      const sub = page.getByRole("tab");
      const n = Math.min(await sub.count(), 14);
      for (let i = 0; i < n; i++) {
        const s = sub.nth(i);
        const nm = (await s.innerText().catch(() => "")).trim();
        if (["Team", "Table", "Club", "Match"].includes(nm)) continue;
        await s.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(250);
        await audit(page, `Manager ${t} › ${nm.slice(0, 20)} @320`, SMALL);
      }
    }
    await page.getByRole("tab", { name: "Match" }).click({ timeout: 2000 }).catch(() => {});
    // One live match with double taps.
    const play = btn(page, "Play match");
    if (await visible(play)) {
      const md0 = (await save())?.matchdayIndex;
      await play.dblclick().catch(() => {});
      await page.waitForTimeout(1200);
      await audit(page, "Manager live match @320", SMALL);
      await btn(page, "Skip to full time").dblclick().catch(() => {});
      await page.waitForTimeout(600);
      await audit(page, "Manager full time @320", SMALL);
      await btn(page, "Continue").dblclick().catch(() => {});
      await page.waitForTimeout(500);
      const md1 = (await save())?.matchdayIndex;
      if (typeof md0 === "number" && typeof md1 === "number" && md1 - md0 > 1) problem("double-action", `double taps on Play match / Continue played ${md1 - md0} rounds`);
    }
    // Reload mid-season resumes the same matchday.
    const before = await save();
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page, 900);
    const after = await save();
    if (before && after && before.matchdayIndex !== after.matchdayIndex) problem("resume", `Manager reload moved the season (${before.matchdayIndex} → ${after.matchdayIndex})`);
    // Season loop.
    const seen = new Set();
    for (let i = 0; i < 600; i++) {
      if (await visible(page.getByRole("region", { name: "Season over" }))) break;
      if (await visible(page.getByTestId("season-review"))) break;
      if (await crashed(page)) {
        problem("crash", "Manager season shows the error screen").shot ||= await shot(page, "manager-crash");
        break;
      }
      if (await page.getByTestId("career-event").isVisible().catch(() => false)) await page.keyboard.press("Escape");
      const shut = btn(page, "Shut the window");
      if (await visible(shut)) {
        if (!seen.has("deadline")) {
          seen.add("deadline");
          await audit(page, "Manager Deadline Day @320", SMALL);
          await btn(page, "Buy and sell").click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(400);
          await audit(page, "Manager Deadline Day market @320", SMALL);
          if (!(await visible(page.getByRole("navigation", { name: "Manager sections" })))) problem("manager", "Deadline Day market @320: the Manager bottom bar isn't showing");
          await btn(page, "Back to Deadline Day").click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(300);
        }
        await shut.dblclick().catch(() => {});
        await page.waitForTimeout(300);
        continue;
      }
      for (const [region, key] of [["League over", "league"], ["Promotion and relegation", "promo"]]) {
        if (!seen.has(key) && (await visible(page.getByRole("region", { name: region })))) {
          seen.add(key);
          await audit(page, `Manager ${region} @320`, SMALL);
        }
      }
      const go = btn(page, /^(On to the play-offs|On to the Million Pound Game|Watch the play-offs|On to the Grand Final|Watch the Grand Final|Quick sim|Continue|Skip to full time)$/);
      if (await visible(go)) {
        await go.click({ force: true, noWaitAfter: true }).catch(() => {});
        await go.click({ force: true, noWaitAfter: true }).catch(() => {});
      }
      await page.waitForTimeout(140);
    }
    const over = page.getByRole("region", { name: "Season over" });
    if (await visible(over)) {
      await audit(page, "Manager season over @320", SMALL);
      await btn(page, "See the season review").dblclick().catch(() => {});
    }
    const review = page.getByTestId("season-review");
    if (!(await review.waitFor({ timeout }).then(() => true, () => false))) {
      problem("flow", `Manager never reached the season review (stages seen: ${[...seen].join(", ") || "none"})`, "Manager season").shot ||= await shot(page, "manager-no-review");
      return;
    }
    await audit(page, "Manager season review @320", SMALL);
    note(`Manager: season to the review (${[...seen].join(", ")})`);
    await btn(page, "Next: retirements and contracts").dblclick().catch(() => {});
    await page.getByRole("heading", { name: "Comings and goings" }).waitFor({ timeout }).catch(() => {});
    await audit(page, "Manager departures @320", SMALL);
    await btn(page, /^(Open the transfer window|Continue to the window)$/).click().catch(() => {});
    await btn(page, /^Let \d+ go · open the window$/).click({ timeout: 3000 }).catch(() => {});
    await page.getByRole("heading", { name: "Build your squad" }).waitFor({ timeout }).catch(() => {});
    await audit(page, "Manager summer window @320", SMALL);
    for (const t of ["Buy", "Sell", "Free agents", "Loans"]) {
      if (await visible(page.getByRole("tab", { name: t }))) {
        await page.getByRole("tab", { name: t }).click().catch(() => {});
        await page.waitForTimeout(300);
        await audit(page, `Manager summer › ${t} @320`, SMALL);
      }
    }
    // Double tap Sign on the first affordable player.
    const signBtn = page.getByRole("button", { name: /^(Sign|Buy|Free)\b/ }).first();
    if (await signBtn.isEnabled().catch(() => false)) {
      const s0 = await save();
      await signBtn.dblclick().catch(() => {});
      await page.waitForTimeout(500);
      const s1 = await save();
      if (s0 && s1) {
        const n0 = s0.clubs?.[s0.userClubId]?.squad?.length ?? 0;
        const n1 = s1.clubs?.[s1.userClubId]?.squad?.length ?? 0;
        if (n1 - n0 > 1) problem("double-action", `Manager: double tap on Sign signed ${n1 - n0} players`);
      }
    }
    await btn(page, /Start (the )?\d{4} season/).dblclick().catch(() => {});
    await page.getByRole("region", { name: "Pre-season friendlies" }).waitFor({ timeout }).catch(() => problem("flow", "Manager: next season didn't open on pre-season"));
    await audit(page, "Manager season 2 pre-season @320", SMALL);
    note("Manager: summer (departures, window) into season 2");
    // Storage cleared mid-career.
    await page.evaluate(() => localStorage.clear());
    await btn(page, /Quick sim|Play match|Continue/).click({ timeout: 2000 }).catch(() => {});
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page, 1000);
    if (await crashed(page)) problem("crash", "Manager crashed after storage was cleared");
    note("Manager: storage cleared mid-career, reloaded");
  }, SMALL);

  /* --- Manager (v1.65): an NRL career at 320 — the picker's NRL tab, the World Club Challenge, the ladder, the finals. */
  await flow("Manager NRL", async (page) => {
    await page.goto(`${BASE}/manager`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.removeItem("27-0-career-v2-save"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page, 800);
    await page.getByRole("tab", { name: "NRL", exact: true }).click({ timeout }).catch(() => problem("flow", "Manager: no NRL tab on the club picker"));
    await page.waitForTimeout(300);
    await audit(page, "Manager picker › NRL @320", SMALL);
    const nrlCount = await page.getByRole("list", { name: "Clubs" }).getByRole("button").count();
    if (nrlCount !== 17) problem("manager", `NRL tab lists ${nrlCount} clubs (expected 17)`);
    await page.getByRole("list", { name: "Clubs" }).getByRole("button", { name: /Brisbane Broncos/ }).click({ timeout }).catch(() => {});
    await btn(page, /Take charge of/).dblclick({ timeout }).catch(() => {});
    await page.getByRole("dialog", { name: "Manager Mode walkthrough" }).getByRole("button", { name: "Skip" }).click({ timeout: 8000 }).catch(() => {});
    await settle(page, 600);
    await audit(page, "Manager NRL pre-season @320", SMALL);
    await btn(page, /^Skip pre-season/).dblclick().catch(() => {});
    await page.waitForTimeout(600);
    if (!(await visible(page.getByTestId("wcc-banner")))) problem("manager", "NRL: no World Club Challenge banner for Brisbane");
    await audit(page, "Manager World Club Challenge @320", SMALL);
    await btn(page, "Quick sim").dblclick().catch(() => {});
    await page.waitForTimeout(700);
    await audit(page, "Manager WCC result pop-up @320", SMALL);
    for (let i = 0; i < 4 && (await page.getByTestId("career-event").isVisible().catch(() => false)); i++) await page.keyboard.press("Escape");
    for (const t of ["Team", "Table", "Club", "Match"]) {
      await page.getByRole("tab", { name: t }).click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
      await audit(page, `Manager NRL ${t} tab @320`, SMALL);
      const sub = page.getByRole("tab");
      const n = Math.min(await sub.count(), 14);
      for (let i = 0; i < n; i++) {
        const st = sub.nth(i);
        const nm = (await st.innerText().catch(() => "")).trim();
        if (["Team", "Table", "Club", "Match"].includes(nm)) continue;
        await st.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(250);
        await audit(page, `Manager NRL ${t} › ${nm.slice(0, 20)} @320`, SMALL);
      }
    }
    await page.getByRole("tab", { name: "Match" }).click({ timeout: 2000 }).catch(() => {});
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      if (await visible(page.getByRole("region", { name: "Season over" }))) break;
      if (await crashed(page)) {
        problem("crash", "Manager NRL season shows the error screen").shot ||= await shot(page, "manager-nrl-crash");
        break;
      }
      if (await page.getByTestId("career-event").isVisible().catch(() => false)) await page.keyboard.press("Escape");
      const shut = btn(page, "Shut the window");
      if (await visible(shut)) {
        await shut.click().catch(() => {});
        await page.waitForTimeout(300);
        continue;
      }
      if (!seen.has("league") && (await visible(page.getByRole("region", { name: "League over" })))) {
        seen.add("league");
        await audit(page, "Manager NRL league over @320", SMALL);
      }
      const go = btn(page, /^(On to the finals|Watch the finals|Quick sim|Continue|Skip to full time)$/);
      if (await visible(go)) await go.click({ force: true, noWaitAfter: true }).catch(() => {});
      await page.waitForTimeout(140);
    }
    if (await visible(page.getByRole("region", { name: "Season over" }))) {
      await audit(page, "Manager NRL season over @320", SMALL);
      await btn(page, "See the season review").click().catch(() => {});
      if (await page.getByTestId("season-review").waitFor({ timeout }).then(() => true, () => false)) {
        await audit(page, "Manager NRL season review @320", SMALL);
        if (!(await visible(page.getByTestId("review-nrl-finals")))) problem("manager", "NRL review: no NRL finals bracket");
        note(`Manager NRL: season to the review (${[...seen].join(", ")})`);
      } else problem("flow", "Manager NRL never reached the season review");
    } else problem("flow", "Manager NRL season never finished", "Manager NRL").shot ||= await shot(page, "manager-nrl-no-end");
  }, SMALL);

  /* --- Mini-games and quiz: play each quickly, with button mashing. */
  await flow("Mini-games", async (page) => {
    for (const route of ["/mini-games/quiz", "/mini-games/wordle", "/mini-games/grid"]) {
      where = `play ${route}`;
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await settle(page, 900);
      await tapFirst(page, [/^Current/i, /Start quiz|Golden Point Quiz|Normal Quiz|^Play/i]);
      await page.waitForTimeout(600);
      for (let i = 0; i < 14; i++) {
        const input = page.locator("main input[type='text'], main input:not([type]), main [role='combobox']").first();
        if (await visible(input)) {
          await input.fill(["Sam Tomkins", "zzz", "Kevin Sinfield", "x".repeat(60)][i % 4]).catch(() => {});
          await page.keyboard.press("Enter").catch(() => {});
        } else {
          const opts = page.locator("main button:visible");
          const n = await opts.count();
          if (n) await opts.nth(i % Math.min(n, 4)).dblclick({ timeout: 1500 }).catch(() => {});
        }
        await page.waitForTimeout(250);
        await tapFirst(page, [/Next question|^Next$|^Continue$/i]);
      }
      await audit(page, `${route} after play @390`, PHONE);
      await page.reload({ waitUntil: "domcontentloaded" });
      await settle(page, 700);
      if (await crashed(page)) problem("crash", `${route} reload mid-game crashed`);
    }
    note("Mini-games: Quiz, Wordle, Grid played with mashing + reload");
  });

  /* --- Corrupted storage: garbage, wrong-shaped and extreme values in every key. */
  await flow("Corrupted storage", async (page, context) => {
    // Fill storage by visiting the main screens first, then add every known key.
    for (const r of ["/", "/play", "/manager", "/store", "/mini-games/wordle", "/mini-games/grid", "/mini-games/quiz", "/profile", "/settings"]) {
      await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded" });
      await settle(page, 500);
    }
    const KNOWN = [
      "27-0-username", "27-0-stats", "27-0-leaderboard", "27-0-difficulty", "27-0-hard-mode-enabled", "27-0-normal-difficulty",
      "27-0-draft-difficulty", "27-0-sound-muted", "27-0-recruitment-style", "27-0-normal-era-variant", "27-0-club-funds",
      "27-0-club-funds-leaderboard", "27-0-daily-challenge-claims", "27-0-daily-challenge-meta", "27-0-daily-leaderboard", "27-0-weekly",
      "27-0-weekly-v1", "27-0-trophy-cabinet-leaderboard", "27-0-ui-theme-store", "27-0-dark-mode", "27-0-cosmetics-store",
      "27-0-hidden-coaches", "27-0-squad-book", "27-0-mode-records", "27-0-ui-theme-css-cache", "27-0-boost-inventory",
      "27-0-manager-career", "27-0-manager-stats", "27-0-manager-leaderboard", "27-0-manager-active-slot", "27-0-manager-onboarding",
      "27-0-achievements", "27-0-quiz-run", "27-0-quiz-stats", "27-0-quiz-leaderboard", "27-0-mini-games-leaderboard",
      "27-0-wordle-run", "27-0-wordle-stats", "27-0-grid-run", "27-0-grid-stats", "27-0-hangman-run", "27-0-hangman-stats",
      "27-0-higher-lower-run", "27-0-higher-lower-stats", "27-0-career-v2-save", "27-0-career-v2-legacy", "27-0-daily-missions",
      "27-0-daily-bonus", "27-0-daily-attempt", "27-0-cup-leaderboard", "27-0-era-cup-leaderboard", "27-0-run-history",
      "27-0-quick-spins", "27-0-qm-boosted-first-pick", "27-0-missions-v1", "27-0-session-count", "27-0-app-resume",
      "27-0-login-welcome", "27-0-install-card-dismissed", "27-0-manager-saves", "27-0-manager-career-slot-0", "27-0-manager-career-meta-0",
      "27-0-manager-career-backup-0",
    ];
    const keys = [...new Set([...(await page.evaluate(() => Object.keys(localStorage))), ...KNOWN])];
    const VARIANTS = [
      ["garbage", "{\"broken\":"],
      ["wrong-shaped", JSON.stringify({ wins: "lots", games: null, balance: -1, version: 999, items: "x", owned: "all", squad: 7, clubs: [] })],
      ["array", "[null,1,\"x\",{}]"],
      ["null", "null"],
      ["number", "1e309"],
    ];
    const ROUTES2 = ["/", "/play", "/play?era=1", "/play?daily=1", "/manager", "/store", "/leaderboard", "/profile", "/records", "/squad-book", "/settings", "/modes", "/mini-games", "/mini-games/wordle", "/mini-games/grid", "/mini-games/quiz", "/stats"];
    const badRoutes = new Map();
    for (const [vname, val] of VARIANTS) {
      for (const route of ROUTES2) {
        try {
          where = `${route} with ${vname} storage`;
          await page.goto(`${BASE}/privacy`, { waitUntil: "domcontentloaded" }).catch(() => {});
          await page.evaluate(([ks, v]) => {
            for (const k of ks) localStorage.setItem(k, k.includes("muted") ? "maybe" : v);
          }, [keys, val]);
          const errsBefore = problems.size;
          await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
          await settle(page, 900);
          const dead = await crashed(page);
          const empty = (await page.locator("main").innerText().catch(() => "")).trim().length < 20;
          if (dead || empty) {
            const p = problem("corrupt-storage", `${route}: ${dead ? "error screen" : "blank page"} with ${vname} values in storage`);
            p.shot ||= await shot(page, `corrupt-${vname}-${route}`);
            badRoutes.set(route, val);
          }
          // Recovery: start using the screen.
          if (route.startsWith("/play")) {
            await tapFirst(page, [/Let.?s play/i, /Skip boost|Continue without boost/i]);
            await signOne(page).catch(() => {});
            if (await crashed(page)) problem("corrupt-storage", `${route}: can't play after ${vname} storage (crash on first signing)`);
          }
          if (route === "/manager") {
            const club = page.getByRole("list", { name: "Clubs" }).getByRole("button").first();
            if (await visible(club)) {
              await club.click().catch(() => {});
              await btn(page, /Take charge of/).click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(800);
              if (await crashed(page)) problem("corrupt-storage", `/manager: can't start a career after ${vname} storage`);
            } else if (!(await visible(btn(page, /Play match|Quick sim|Continue/)))) {
              problem("corrupt-storage", `/manager with ${vname} storage: neither the club picker nor a career`).shot ||= await shot(page, `corrupt-manager-${vname}`);
            }
          }
          if (problems.size > errsBefore) badRoutes.set(route, val);
        } catch (e) {
          problem("corrupt-storage", `${route} with ${vname} storage: ${String(e).split("\n")[0].slice(0, 160)}`);
          badRoutes.set(route, val);
          if (page.isClosed()) page = wire(await context.newPage());
        }
      }
    }
    note(`Corrupted storage: ${keys.length} keys × ${VARIANTS.length} kinds of bad value × ${ROUTES2.length} routes`);
    // Bisect: which key breaks which route.
    for (const [route, val] of [...badRoutes].slice(0, 3)) {
      const culprits = [];
      for (const k of keys) {
        let hit = false;
        const onErr = () => (hit = true);
        try {
          await page.goto(`${BASE}/privacy`, { waitUntil: "domcontentloaded" }).catch(() => {});
          await page.evaluate(() => localStorage.clear());
          page.on("pageerror", onErr);
          await page.evaluate(([kk, v]) => localStorage.setItem(kk, v), [k, val]);
          await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
          await settle(page, 300);
          if (await crashed(page)) hit = true;
        } catch {
          hit = true;
          if (page.isClosed()) page = wire(await context.newPage());
        }
        page.off("pageerror", onErr);
        if (hit) culprits.push(k);
      }
      if (culprits.length) problem("corrupt-storage", `${route} breaks on a bad value in: ${culprits.join(", ")}`, "bisect");
    }
  });
}

await browser.close();
writeReport(true);
const total = problems.size;
console.log(fs.readFileSync(`${OUT}/everything-report.txt`, "utf8"));
console.log(`\ne2e-everything: ${total} distinct problem(s) in ${Math.round((Date.now() - T0) / 1000)}s`);
if (process.env.CI) console.log(`::notice title=e2e-everything::${total} distinct problem(s); see ${OUT}/everything-report.txt`);
process.exit(process.env.EV_STRICT === "1" && total ? 1 : 0);
