/**
 * After `CHUNK_REPORT=1 npm run build`: prints what each route's first-load JS is made of.
 * Uses .next/app-build-manifest.json (route -> files) and .next/chunk-modules.json (file -> modules,
 * from scripts/chunk-report-plugin.cjs). Without the plugin output it still lists the biggest chunk
 * files and any large JSON literals found inside them.
 *
 * Run: node scripts/health-chunk-report.mjs [topN]
 */
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const TOP = Number(process.argv[2] || 25);
const NEXT = ".next";
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const out = [];
const log = (s = "") => out.push(s);

const manifest = JSON.parse(readFileSync(path.join(NEXT, "app-build-manifest.json"), "utf8")).pages;
const fileSize = (f) => {
  try {
    return statSync(path.join(NEXT, f)).size;
  } catch {
    return 0;
  }
};

let byFile = new Map();
const cmPath = path.join(NEXT, "chunk-modules.json");
if (existsSync(cmPath)) {
  const { chunks } = JSON.parse(readFileSync(cmPath, "utf8"));
  for (const c of chunks) for (const f of c.files) byFile.set(f, c);
}

// 1. First-load JS per route.
const routes = Object.entries(manifest)
  .filter(([r]) => r.endsWith("/page"))
  .map(([r, files]) => {
    const js = files.filter((f) => f.endsWith(".js"));
    return { route: r, files: js, size: js.reduce((a, f) => a + fileSize(f), 0) };
  })
  .sort((a, b) => b.size - a.size);

log("## First-load JS per route (minified, uncompressed)");
log("| Route | JS |");
log("|---|---|");
for (const r of routes) log(`| ${r.route} | ${kb(r.size)} |`);
log();

// 2. Biggest chunk files and how many routes load them.
const fileRoutes = new Map();
for (const r of routes) for (const f of r.files) fileRoutes.set(f, (fileRoutes.get(f) || 0) + 1);
const staticFiles = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".js")) staticFiles.push(path.relative(NEXT, p));
  }
};
walk(path.join(NEXT, "static", "chunks"));
staticFiles.sort((a, b) => fileSize(b) - fileSize(a));
log(`## Biggest client chunk files (top ${TOP})`);
log("| File | Size | Routes loading it first | Top modules |");
log("|---|---|---|---|");
for (const f of staticFiles.slice(0, TOP)) {
  const c = byFile.get(f);
  const mods = c ? c.modules.slice(0, 4).map((m) => `${m.name} (${kb(m.size)})`).join("<br>") : "";
  log(`| ${f} | ${kb(fileSize(f))} | ${fileRoutes.get(f) || 0} | ${mods} |`);
}
log();

// 3. Heaviest source modules in first-load JS, with how many routes include them.
if (byFile.size) {
  const modRoutes = new Map();
  for (const r of routes) {
    const seen = new Set();
    for (const f of r.files) {
      const c = byFile.get(f);
      if (!c) continue;
      for (const m of c.modules) {
        if (seen.has(m.name)) continue;
        seen.add(m.name);
        const e = modRoutes.get(m.name) || { size: m.size, routes: [] };
        e.routes.push(r.route.replace(/\/page$/, "") || "/");
        modRoutes.set(m.name, e);
      }
    }
  }
  const mods = [...modRoutes.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, TOP * 2);
  log(`## Heaviest modules in first-load JS (source size, top ${TOP * 2})`);
  log("| Module | Size | # routes | Routes (first 6) |");
  log("|---|---|---|---|");
  for (const [name, e] of mods) log(`| ${name} | ${kb(e.size)} | ${e.routes.length} | ${e.routes.slice(0, 6).join(" ")} |`);
  log();

  // 4. Per key route: top modules.
  for (const key of ["/page", "/play/page", "/store/page", "/profile/page", "/manager/page"]) {
    const r = routes.find((x) => x.route === key);
    if (!r) continue;
    const all = new Map();
    for (const f of r.files) for (const m of byFile.get(f)?.modules || []) all.set(m.name, m.size);
    const total = [...all.values()].reduce((a, b) => a + b, 0);
    const json = [...all.entries()].filter(([n]) => n.endsWith(".json")).reduce((a, [, s]) => a + s, 0);
    log(`### ${key}: ${kb(r.size)} files, ${kb(total)} source modules, of which JSON ${kb(json)}`);
    for (const [n, s] of [...all.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) log(`- ${n} ${kb(s)}`);
    log();
  }
} else {
  // Fallback: big JSON.parse('...') literals inside chunk files.
  log("## Large JSON literals in chunks (no chunk-modules.json)");
  for (const f of staticFiles.slice(0, TOP)) {
    const src = readFileSync(path.join(NEXT, f), "utf8");
    const re = /JSON\.parse\('((?:[^'\\]|\\.){20000,})'\)/g;
    let m;
    while ((m = re.exec(src))) log(`- ${f}: JSON literal ${kb(m[1].length)} starting ${m[1].slice(0, 80)}`);
  }
}

const md = out.join("\n") + "\n";
process.stdout.write(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
