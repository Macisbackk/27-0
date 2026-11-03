/**
 * Mobile performance check (v1.66 health check). Loads the key pages the way phones do:
 * a mid-range Android on slow 4G with a 4× slower CPU, and an iPhone on fast 4G. Reports
 * first paint, largest paint, layout shift, main-thread blocking, JS weight and how fast a
 * tap responds. Report only — it never fails the build.
 *
 * Run: node scripts/health-mobile-perf.mjs [baseUrl]   (default https://www.27-0.co.uk)
 * Writes Markdown to stdout and $GITHUB_STEP_SUMMARY, JSON to health/mobile-perf.json.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium, devices } from "playwright";

const BASE = (process.argv[2] || process.env.PERF_BASE_URL || "https://www.27-0.co.uk").replace(/\/$/, "");
const PAGES = ["/", "/play", "/manager", "/mini-games", "/store", "/squad-book", "/leaderboard"];
const PROFILES = [
  {
    name: "Mid Android, slow 4G",
    device: devices["Pixel 5"],
    cpu: 4,
    net: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  },
  {
    name: "iPhone, fast 4G",
    device: devices["iPhone 13"],
    cpu: 1.5,
    net: { latency: 40, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 },
  },
];

// Collected inside the page from the start of navigation.
const OBSERVE = () => {
  window.__perf = { lcp: 0, cls: 0, longTasks: 0, tbt: 0, events: [], shifts: [] };
  const describe = (n) => {
    if (!n || !n.tagName) return "?";
    const cls = typeof n.className === "string" ? n.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
    const text = (n.textContent || "").trim().slice(0, 30);
    return `${n.tagName.toLowerCase()}${n.id ? "#" + n.id : ""}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
  };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.lcp = Math.max(window.__perf.lcp, e.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__perf.cls += e.value;
        window.__perf.shifts.push({
          t: Math.round(e.startTime),
          v: Number(e.value.toFixed(3)),
          src: (e.sources || []).slice(0, 2).map((s) => describe(s.node)).join(" | "),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__perf.longTasks++;
        window.__perf.tbt += Math.max(0, e.duration - 50);
      }
    }).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.events.push(e.duration);
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  } catch {
    // older engines: some numbers stay 0
  }
};

const results = [];
// PERF_PROFILE="/,/play": CPU-profile those pages (first phone, cold) and print where main-thread time goes.
const PROFILE_PATHS = (process.env.PERF_PROFILE || "").split(",").map((x) => x.trim()).filter(Boolean);
const profiles = [];
function summarizeProfile(path, profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const hits = new Map();
  const dt = profile.timeDeltas || [];
  profile.samples.forEach((id, i) => hits.set(id, (hits.get(id) || 0) + (dt[i + 1] ?? dt[i] ?? 0)));
  const byUrl = new Map();
  const byFn = new Map();
  let total = 0;
  for (const [id, us] of hits) {
    const n = byId.get(id);
    const cf = n.callFrame;
    const url = cf.url ? cf.url.replace(/^https?:\/\/[^/]+/, "").replace(/\?.*$/, "") : `(${cf.functionName || "native"})`;
    if (url === "(idle)") continue;
    total += us;
    byUrl.set(url, (byUrl.get(url) || 0) + us);
    const fk = `${cf.functionName || "(anon)"} ${url}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`;
    byFn.set(fk, (byFn.get(fk) || 0) + us);
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `  ${(v / 1000).toFixed(0).padStart(6)} ms  ${k}`);
  profiles.push([`CPU profile ${path} (busy ${(total / 1000).toFixed(0)} ms, self time by script):`, ...top(byUrl, 12), "  by function:", ...top(byFn, 15)].join("\n"));
}
const browser = await chromium.launch();
for (const profile of PROFILES) {
  for (const path of PAGES) {
    for (const visit of ["cold", "warm"]) {
      // Chromium engine for both profiles (WebKit isn't installed in CI); the iPhone row is its viewport + UA.
      const { defaultBrowserType: _ignored, ...device } = profile.device;
      const context = await browser.newContext(device);
      await context.addInitScript(OBSERVE);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, ...profile.net });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
      let jsBytes = 0;
      let totalBytes = 0;
      page.on("response", async (res) => {
        try {
          const len = Number(res.headers()["content-length"] || 0) || (await res.body().catch(() => Buffer.alloc(0))).length;
          totalBytes += len;
          if (/\.js(\?|$)/.test(res.url())) jsBytes += len;
        } catch {
          // ignore
        }
      });
      const row = { profile: profile.name, path, visit };
      const doProfile = visit === "cold" && profile === PROFILES[0] && PROFILE_PATHS.includes(path);
      try {
        if (doProfile) {
          await cdp.send("Profiler.enable");
          await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
          await cdp.send("Profiler.start");
        }
        if (visit === "warm") {
          await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 90_000 });
          jsBytes = 0;
          totalBytes = 0;
        }
        const t0 = Date.now();
        await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 90_000 });
        row.loadWallMs = Date.now() - t0;
        await page.waitForTimeout(2500);
        // One tap on the first big button / link in main content, then measure the response.
        const target = page.locator("main button:visible, main a[href]:visible").first();
        if (await target.count()) {
          await target.tap({ timeout: 5000, noWaitAfter: true, trial: false }).catch(() => {});
          await page.waitForTimeout(800);
        }
        const m = await page.evaluate(() => {
          const nav = performance.getEntriesByType("navigation")[0];
          const fcp = performance.getEntriesByName("first-contentful-paint")[0];
          const p = window.__perf || {};
          return {
            ttfb: nav ? Math.round(nav.responseStart) : null,
            fcp: fcp ? Math.round(fcp.startTime) : null,
            lcp: Math.round(p.lcp || 0) || null,
            domInteractive: nav ? Math.round(nav.domInteractive) : null,
            cls: Number((p.cls || 0).toFixed(3)),
            tbt: Math.round(p.tbt || 0),
            longTasks: p.longTasks || 0,
            tapMs: p.events && p.events.length ? Math.round(Math.max(...p.events)) : null,
            shifts: (p.shifts || []).filter((x) => x.v >= 0.01).slice(0, 4),
          };
        });
        Object.assign(row, m, { jsKB: Math.round(jsBytes / 1024), totalKB: Math.round(totalBytes / 1024) });
        if (doProfile) {
          const { profile: cpu } = await cdp.send("Profiler.stop");
          summarizeProfile(path, cpu);
        }
      } catch (err) {
        row.error = String(err?.message || err).split("\n")[0];
      }
      results.push(row);
      console.error(`${profile.name} ${path} ${visit}: ${row.error || `LCP ${row.lcp}ms TBT ${row.tbt}ms`}`);
      await context.close();
    }
  }
}
await browser.close();

const grade = (v, good, poor) => (v == null ? "–" : v <= good ? `${v} ✅` : v <= poor ? `${v} 🟡` : `${v} 🔴`);
const lines = [];
lines.push(`# Mobile performance — ${BASE}`);
lines.push(`Thresholds (Core Web Vitals): LCP ≤2500 good / ≤4000 poor, CLS ≤0.1 / ≤0.25, TBT ≤200 / ≤600, tap ≤200 / ≤500 ms.`);
lines.push("");
lines.push(`| Phone | Page | Visit | TTFB | FCP | LCP | CLS | TBT | Tap | JS KB | Total KB |`);
lines.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
for (const r of results) {
  if (r.error) {
    lines.push(`| ${r.profile} | ${r.path} | ${r.visit} | error: ${r.error} |||||||| |`);
    continue;
  }
  lines.push(
    `| ${r.profile} | ${r.path} | ${r.visit} | ${r.ttfb} | ${r.fcp} | ${grade(r.lcp, 2500, 4000)} | ${grade(r.cls, 0.1, 0.25)} | ${grade(r.tbt, 200, 600)} | ${grade(r.tapMs, 200, 500)} | ${r.jsKB} | ${r.totalKB} |`
  );
}
lines.push("");
lines.push("Layout shifts (≥0.01; time ms, score, shifted element):");
for (const r of results) {
  if (!r.shifts || !r.shifts.length) continue;
  lines.push(`- ${r.profile} ${r.path} ${r.visit}: ${r.shifts.map((x) => `@${x.t} ${x.v} ${x.src}`).join(" ; ")}`);
}
if (profiles.length) {
  lines.push("");
  lines.push("```");
  lines.push(...profiles);
  lines.push("```");
}
const md = lines.join("\n") + "\n";
process.stdout.write(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
const OUT = process.env.PERF_OUT_DIR || "health";
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/mobile-perf.json`, JSON.stringify(results, null, 2));
writeFileSync(`${OUT}/mobile-perf.md`, md);
