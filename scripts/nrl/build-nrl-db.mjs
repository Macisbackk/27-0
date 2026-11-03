#!/usr/bin/env node
/**
 * Build the standalone NRL player database (data/nrl/*) from the committed caches.
 *
 *   node scripts/nrl/build-nrl-db.mjs
 *
 * Inputs (all committed, re-fetch instructions in scripts/nrl/README-fetch.md):
 *   scripts/nrl/cache/afltables-seasons/YYYY.txt   per-season NRL scorer tables (1998-2026)
 *   scripts/nrl/cache/wikipedia/*.txt               small Wikipedia extracts (2026 squads, honours)
 *   scripts/wikipedia-cache/*.json                   existing repo cache of Wikipedia player wikitext (bio enrichment)
 *   data/nrl-clubs.json                              existing game club scaffold (colours only; read, never written)
 *
 * NOTHING under src/ imports these outputs. Do not wire into any game mode without a separate change.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE = path.join(ROOT, "scripts/nrl/cache");
const OUT = path.join(ROOT, "data/nrl");
const AFL = (y) => `https://afltables.com/rl/scorers/${y}_sc.html`;
const AFL_PLAYER = (slug) => `https://afltables.com/rl/scorers/players/${slug[0]}/${slug}.html`;

// ---------------------------------------------------------------- clubs
// AFL Tables team codes -> club id. Codes are era-specific (e.g. SG=St George 1998, SI=St George Illawarra 1999+).
const CLUBS = [
  { id: "nrl-brisbane-broncos", codes: ["BR"], name: "Brisbane Broncos", short: "BRI", nick: "Broncos", status: "active" },
  { id: "nrl-canberra-raiders", codes: ["CN"], name: "Canberra Raiders", short: "CAN", nick: "Raiders", status: "active" },
  { id: "nrl-canterbury-bulldogs", codes: ["CB", "BU"], name: "Canterbury-Bankstown Bulldogs", short: "CBY", nick: "Bulldogs", status: "active" },
  { id: "nrl-cronulla-sharks", codes: ["CS", "SH"], name: "Cronulla-Sutherland Sharks", short: "CRO", nick: "Sharks", status: "active" },
  { id: "nrl-dolphins", codes: ["DO"], name: "Dolphins", short: "DOL", nick: "Dolphins", status: "active" },
  { id: "nrl-gold-coast-titans", codes: ["TI"], name: "Gold Coast Titans", short: "GCT", nick: "Titans", status: "active" },
  { id: "nrl-manly-sea-eagles", codes: ["MW"], name: "Manly Warringah Sea Eagles", short: "MAN", nick: "Sea Eagles", status: "active" },
  { id: "nrl-melbourne-storm", codes: ["MS"], name: "Melbourne Storm", short: "MEL", nick: "Storm", status: "active" },
  { id: "nrl-newcastle-knights", codes: ["NC"], name: "Newcastle Knights", short: "NEW", nick: "Knights", status: "active" },
  { id: "nrl-new-zealand-warriors", codes: ["NZ", "AK"], name: "New Zealand Warriors", short: "NZW", nick: "Warriors", status: "active", note: "Auckland Warriors until 2000 (code AK)." },
  { id: "nrl-north-queensland-cowboys", codes: ["NQ"], name: "North Queensland Cowboys", short: "NQL", nick: "Cowboys", status: "active" },
  { id: "nrl-parramatta-eels", codes: ["PR"], name: "Parramatta Eels", short: "PAR", nick: "Eels", status: "active" },
  { id: "nrl-penrith-panthers", codes: ["PN"], name: "Penrith Panthers", short: "PEN", nick: "Panthers", status: "active" },
  { id: "nrl-south-sydney-rabbitohs", codes: ["SS"], name: "South Sydney Rabbitohs", short: "SOU", nick: "Rabbitohs", status: "active", note: "Excluded from the competition in 2000-2001." },
  { id: "nrl-st-george-illawarra-dragons", codes: ["SI"], name: "St. George Illawarra Dragons", short: "SGI", nick: "Dragons", status: "active", note: "Joint venture formed 1999 from St. George and Illawarra." },
  { id: "nrl-sydney-roosters", codes: ["SR", "SC"], name: "Sydney Roosters", short: "SYD", nick: "Roosters", status: "active", note: "Played as Sydney City Roosters in 1998-1999 (code SC)." },
  { id: "nrl-wests-tigers", codes: ["WT"], name: "Wests Tigers", short: "WST", nick: "Tigers", status: "active", note: "Joint venture formed 2000 from Balmain and Western Suburbs." },
  { id: "nrl-perth-bears", codes: [], name: "Perth Bears", short: "PTH", nick: "Bears", status: "future", note: "Not in the 2026 competition (2026 NRL season article lists 17 clubs)." },
  { id: "nrl-png-chiefs", codes: [], name: "PNG Chiefs", short: "PNG", nick: "Chiefs", status: "future", note: "Not in the 2026 competition (2026 NRL season article lists 17 clubs)." },
  { id: "nrl-adelaide-rams", codes: ["AD"], name: "Adelaide Rams", short: "ADE", nick: "Rams", status: "defunct" },
  { id: "nrl-gold-coast-chargers", codes: ["GC"], name: "Gold Coast Chargers", short: "GCC", nick: "Chargers", status: "defunct" },
  { id: "nrl-balmain-tigers", codes: ["BL"], name: "Balmain Tigers", short: "BAL", nick: "Tigers", status: "merged", mergedInto: "nrl-wests-tigers" },
  { id: "nrl-western-suburbs-magpies", codes: ["WS"], name: "Western Suburbs Magpies", short: "WSM", nick: "Magpies", status: "merged", mergedInto: "nrl-wests-tigers" },
  { id: "nrl-north-sydney-bears", codes: ["NS"], name: "North Sydney Bears", short: "NOR", nick: "Bears", status: "merged", mergedInto: "nrl-northern-eagles" },
  { id: "nrl-northern-eagles", codes: ["NE"], name: "Northern Eagles", short: "NTE", nick: "Eagles", status: "defunct", note: "Manly/North Sydney joint venture 2000-2002." },
  { id: "nrl-st-george-dragons", codes: ["SG"], name: "St. George Dragons", short: "STG", nick: "Dragons", status: "merged", mergedInto: "nrl-st-george-illawarra-dragons" },
  { id: "nrl-illawarra-steelers", codes: ["IL"], name: "Illawarra Steelers", short: "ILL", nick: "Steelers", status: "merged", mergedInto: "nrl-st-george-illawarra-dragons" },
];
const CODE_TO_CLUB = Object.fromEntries(CLUBS.flatMap((c) => c.codes.map((k) => [k, c.id])));
// Disambiguation suffixes used in AFL Tables slugs that encode a club.
const SUFFIX_CLUB = { ...CODE_TO_CLUB, ES: "nrl-sydney-roosters", NS: "nrl-north-sydney-bears", SG: "nrl-st-george-dragons" };

// ---------------------------------------------------------------- helpers
const kebab = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const SUFFIX_RE = /^(.*[a-z])((?:[A-Z]{2})|(?:P\d))$/;
const splitSlug = (slug) => { const m = slug.match(SUFFIX_RE); return m ? { base: m[1], suffix: m[2] } : { base: slug, suffix: null }; };
const nameFromSlug = (slug) => splitSlug(slug).base.replace(/_/g, " ");
const normName = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const num = (v) => (v === undefined || v === "" ? 0 : Number(v));

// ---------------------------------------------------------------- parse season caches
const seasonRows = []; // {season, slug, name, codes, P,T,G,FG,Pts}
const seasonMeta = {};
for (const f of fs.readdirSync(path.join(CACHE, "afltables-seasons")).sort()) {
  const season = Number(f.slice(0, 4));
  const text = fs.readFileSync(path.join(CACHE, "afltables-seasons", f), "utf8");
  const header = text.split("\n").filter((l) => l.startsWith("#")).join("\n");
  const v1 = /format: slug\|name/.test(header);
  seasonMeta[season] = { sourceUrl: AFL(season), note: (header.match(/fetched: (.*)/) || [])[1] || null, rows: 0 };
  const seen = new Set();
  for (const line of text.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const p = line.split("|");
    let slug, name = null, tm, P, T, G, FG, Pts = null;
    if (v1) { [slug, name, tm, P, T, G, FG, Pts] = p; name = name || null; Pts = Pts === "" || Pts === undefined ? null : Number(Pts); }
    else {
      [slug, tm, P] = p;
      const rest = p.slice(3);
      const nums = []; for (const r of rest) { if (/^\d*$/.test(r)) nums.push(r); else { name = r; break; } }
      [T, G, FG] = nums;
    }
    if (!slug || !tm || !/^\d+$/.test(P || "")) continue;
    const codes = tm.trim().split(/[\s/]+/);
    const key = `${slug}|${codes.join(" ")}`;
    if (seen.has(key)) continue; // a few fetches repeated rows
    seen.add(key);
    const t = num(T), g = num(G), fg = num(FG);
    seasonRows.push({ season, slug, name, codes, P: Number(P), T: t, G: g, FG: fg, Pts: Pts ?? (season <= 2018 ? 4 * t + 2 * g + fg : null) });
    seasonMeta[season].rows++;
  }
}

// ---------------------------------------------------------------- resolve namesakes -> canonical slug
const variantsByBase = new Map();
for (const r of seasonRows) { const { base, suffix } = splitSlug(r.slug); if (!variantsByBase.has(base)) variantsByBase.set(base, new Set()); if (suffix) variantsByBase.get(base).add(r.slug); }
const seasonsBySlug = new Map();
for (const r of seasonRows) { if (!seasonsBySlug.has(r.slug)) seasonsBySlug.set(r.slug, []); seasonsBySlug.get(r.slug).push(r); }
const ambiguous = [];
for (const r of seasonRows) {
  const { base, suffix } = splitSlug(r.slug);
  r.canonical = r.slug;
  if (suffix) continue;
  const vs = [...(variantsByBase.get(base) || [])];
  if (!vs.length) continue;
  const clubs = r.codes.map((c) => CODE_TO_CLUB[c]);
  let best = null, bestScore = -Infinity;
  for (const v of vs) {
    const sc = SUFFIX_CLUB[splitSlug(v).suffix];
    let score = 0;
    if (sc && clubs.includes(sc)) score += 20;
    if (sc === "nrl-st-george-dragons" && clubs.includes("nrl-st-george-illawarra-dragons")) score += 15;
    const other = seasonsBySlug.get(v) || [];
    if (other.some((o) => o.codes.some((c) => r.codes.includes(c)))) score += 10;
    const dist = Math.min(...other.map((o) => Math.abs(o.season - r.season)), 99);
    score -= dist;
    if (score > bestScore) { bestScore = score; best = v; }
  }
  if (vs.length === 1 || bestScore > -3) r.canonical = best;
  else ambiguous.push({ slug: r.slug, season: r.season, codes: r.codes, candidates: vs });
}

// ---------------------------------------------------------------- Wikipedia enrichment (existing repo cache)
const CLUB_WORDS = { "nrl-brisbane-broncos": /Brisbane Broncos/, "nrl-canberra-raiders": /Canberra Raiders/, "nrl-canterbury-bulldogs": /Canterbury|Bulldogs/, "nrl-cronulla-sharks": /Cronulla/, "nrl-dolphins": /Dolphins \(NRL\)|\[\[Dolphins/, "nrl-gold-coast-titans": /Gold Coast Titans/, "nrl-manly-sea-eagles": /Manly/, "nrl-melbourne-storm": /Melbourne Storm/, "nrl-newcastle-knights": /Newcastle Knights/, "nrl-new-zealand-warriors": /Warriors/, "nrl-north-queensland-cowboys": /North Queensland Cowboys/, "nrl-parramatta-eels": /Parramatta/, "nrl-penrith-panthers": /Penrith/, "nrl-south-sydney-rabbitohs": /South Sydney/, "nrl-st-george-illawarra-dragons": /St\.? George Illawarra/, "nrl-sydney-roosters": /Sydney Roosters|Sydney City|Eastern Suburbs/, "nrl-wests-tigers": /Wests Tigers/, "nrl-adelaide-rams": /Adelaide Rams/, "nrl-gold-coast-chargers": /Gold Coast Chargers/, "nrl-balmain-tigers": /Balmain/, "nrl-western-suburbs-magpies": /Western Suburbs/, "nrl-north-sydney-bears": /North Sydney/, "nrl-northern-eagles": /Northern Eagles/, "nrl-st-george-dragons": /St\.? George Dragons/, "nrl-illawarra-steelers": /Illawarra Steelers/ };
const REP_TEAMS = [["New South Wales", "State of Origin"], ["Queensland", "State of Origin"], ["Australia", "International"], ["New Zealand", "International"], ["Samoa", "International"], ["Tonga", "International"], ["Fiji", "International"], ["Papua New Guinea", "International"], ["Cook Islands", "International"], ["England", "International"], ["Great Britain", "International"], ["Lebanon", "International"], ["Italy", "International"], ["Scotland", "International"], ["Ireland", "International"], ["Wales", "International"], ["France", "International"], ["Greece", "International"], ["Malta", "International"]];
const wikiByName = new Map();
const wikiDir = path.join(ROOT, "scripts/wikipedia-cache");
if (fs.existsSync(wikiDir)) {
  for (const f of fs.readdirSync(wikiDir)) {
    if (!f.endsWith(".json")) continue;
    let j; try { j = JSON.parse(fs.readFileSync(path.join(wikiDir, f), "utf8")); } catch { continue; }
    const wt = j.wikitext || ""; if (!/Infobox rugby league/i.test(wt)) continue;
    const field = (k) => { const m = wt.match(new RegExp(`\\|\\s*${k}\\s*=\\s*([^\\n]*)`)); return m ? m[1].trim() : null; };
    const bd = (field("birth_date") || "").match(/(\d{4})\|(\d{1,2})\|(\d{1,2})/);
    const conv = (s, unit) => { if (!s) return null; const m = s.match(/convert\|([\d.]+)\|([a-z]+)/); if (m && m[2] === unit) return Number(m[1]); const ft = s.match(/convert\|(\d)\|ft\|(\d+)\|in/); if (unit === "m" && ft) return Math.round((Number(ft[1]) * 30.48 + Number(ft[2]) * 2.54)) / 100; const st = s.match(/convert\|(\d+)\|st\|(\d+)\|lb/); if (unit === "kg" && st) return Math.round((Number(st[1]) * 14 + Number(st[2])) * 0.4536); return null; };
    const hRaw = field("height"); const wRaw = field("weight");
    let heightM = conv(hRaw, "m"); const hcm = hRaw && hRaw.match(/convert\|(\d{3})\|cm/); if (hcm) heightM = Number(hcm[1]) / 100;
    const posRaw = field("position") || ""; const pos = (posRaw.match(/rlp\|([^}]*)/) || [])[1];
    const rep = []; for (const m of wt.matchAll(/\|\s*team[A-Z]\s*=\s*([^\n]*)/g)) { for (const [t, kind] of REP_TEAMS) { if (m[1].includes(t) && !/Under|U\d|Residents|Prime Minister|All Stars|Nines|Country|City|Origin \(?Women/i.test(m[1]) && !rep.some((x) => x.team === t)) rep.push({ team: t, kind }); } }
    const clubs = Object.entries(CLUB_WORDS).filter(([, re]) => { for (const m of wt.matchAll(/\|\s*club\d+\s*=\s*([^\n]*)/g)) if (re.test(m[1])) return true; return false; }).map(([id]) => id);
    const rec = { title: j.title, sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent((j.title || "").replace(/ /g, "_"))}`, dateOfBirth: bd ? `${bd[1]}-${bd[2].padStart(2, "0")}-${bd[3].padStart(2, "0")}` : null, birthPlace: (field("birth_place") || "").replace(/\[\[([^|\]]*\|)?([^\]]*)\]\]/g, "$2").replace(/<[^>]*>|\{\{[^}]*\}\}/g, "").trim() || null, heightCm: heightM ? Math.round(heightM * 100) : null, weightKg: conv(wRaw, "kg"), positionCodes: pos ? pos.split("|").filter((x) => /^[A-Z]{2}$/.test(x)) : [], representative: rep, nrlClubsInInfobox: clubs };
    for (const key of [j.title, field("name")].filter(Boolean)) { const k = normName(key.replace(/\(.*?\)/g, "")); if (!wikiByName.has(k)) wikiByName.set(k, []); if (!wikiByName.get(k).includes(rec)) wikiByName.get(k).push(rec); }
  }
}
const POS = { FB: "Fullback", WG: "Wing", CE: "Centre", FE: "Five-eighth", SO: "Five-eighth", HB: "Halfback", SH: "Halfback", HK: "Hooker", PR: "Prop", SR: "Second-row", LK: "Lock", LF: "Lock", UB: "Utility", UT: "Utility", BE: "Bench", IN: "Interchange" };

// ---------------------------------------------------------------- 2026 squad extracts (Wikipedia)
const squadExtras = [];
const wdir = path.join(CACHE, "wikipedia");
if (fs.existsSync(wdir)) for (const f of fs.readdirSync(wdir).filter((x) => x.startsWith("squad-2026-"))) {
  const text = fs.readFileSync(path.join(wdir, f), "utf8");
  const club = (text.match(/# club: (\S+)/) || [])[1]; const src = (text.match(/# source: (\S+)/) || [])[1];
  for (const line of text.split("\n")) { if (!line.trim() || line.startsWith("#")) continue; const [cap, nat, name, position, debut, prev] = line.split("|"); squadExtras.push({ club, src, cap: /^\d+$/.test(cap) ? Number(cap) : null, nat, name: name.replace(/\s*\(c\)\s*$/, ""), captain: /\(c\)/.test(name), position, debut, prev: prev === "N/A" ? null : prev }); }
}

// ---------------------------------------------------------------- assemble people
const people = new Map();
for (const r of seasonRows) {
  const id = "nrl-" + kebab(r.canonical.replace(/_/g, " ").replace(/([a-z])([A-Z]{2}|P\d)$/, "$1 $2"));
  if (!people.has(id)) people.set(id, { id, afltablesSlug: r.canonical, names: new Set(), rows: [] });
  const p = people.get(id); if (r.name) p.names.add(r.name);
  p.rows.push(r);
}
const players = [];
let wikiHits = 0;
for (const p of people.values()) {
  const name = [...p.names][0] || nameFromSlug(p.afltablesSlug);
  const seasons = p.rows.sort((a, b) => a.season - b.season).map((r) => ({ season: r.season, clubId: CODE_TO_CLUB[r.codes[0]] ?? null, ...(r.codes.length > 1 ? { clubIds: r.codes.map((c) => CODE_TO_CLUB[c] ?? null), multiClubSeason: true } : {}), apps: r.P, tries: r.T, goals: r.G, fieldGoals: r.FG, points: r.Pts, ...(r.slug !== r.canonical ? { sourceSlug: r.slug } : {}) }));
  const clubIds = [...new Set(seasons.flatMap((s) => s.clubIds ?? [s.clubId]).filter(Boolean))];
  // wiki match: same normalized name AND infobox lists at least one of the player's NRL clubs (namesake guard)
  const cands = (wikiByName.get(normName(name)) || []).filter((w) => w.nrlClubsInInfobox.some((c) => clubIds.includes(c)));
  const w = cands.length === 1 ? cands[0] : null; if (w) wikiHits++;
  const totals = seasons.reduce((a, s) => ({ apps: a.apps + s.apps, tries: a.tries + s.tries, goals: a.goals + s.goals, fieldGoals: a.fieldGoals + s.fieldGoals }), { apps: 0, tries: 0, goals: 0, fieldGoals: 0 });
  players.push({
    id: p.id, name, nameSource: p.names.size ? "afltables-display" : "afltables-slug",
    dateOfBirth: w?.dateOfBirth ?? null, birthYear: w?.dateOfBirth ? Number(w.dateOfBirth.slice(0, 4)) : null, birthPlace: w?.birthPlace ?? null,
    nationality: null, representative: w?.representative?.length ? w.representative : null,
    stateOfOrigin: w?.representative?.find((x) => x.kind === "State of Origin")?.team ?? null,
    internationalTeams: w?.representative?.filter((x) => x.kind === "International").map((x) => x.team) ?? null,
    positions: w?.positionCodes?.length ? [...new Set(w.positionCodes.map((c) => POS[c] || c))] : null,
    heightCm: w?.heightCm ?? null, weightKg: w?.weightKg ?? null,
    firstSeason: seasons[0].season, lastSeason: seasons.at(-1).season, clubIds,
    nrlTotals1998on: { ...totals, seasonsListed: seasons.length, note: "Sum of listed 1998+ seasons only (pre-1998 premiership games not included; truncated season pages may omit a few low-game seasons)." },
    seasons,
    sources: { afltables: AFL_PLAYER(p.afltablesSlug), wikipedia: w?.sourceUrl ?? null },
  });
}
players.sort((a, b) => a.id.localeCompare(b.id));

// ---------------------------------------------------------------- current squads 2026
const byClub = {};
for (const pl of players) for (const s of pl.seasons.filter((x) => x.season === 2026)) for (const c of s.clubIds ?? [s.clubId]) { (byClub[c] ||= []).push({ playerId: pl.id, name: pl.name, apps2026: s.apps, tries2026: s.tries, goals2026: s.goals, fieldGoals2026: s.fieldGoals, points2026: s.points, multiClubSeason: s.multiClubSeason, positions: pl.positions, dateOfBirth: pl.dateOfBirth, representative: pl.representative, nrlDebutSeason: pl.firstSeason, basis: "played-2026", sourceUrl: AFL(2026) }); }
for (const e of squadExtras) {
  const list = (byClub[e.club] ||= []);
  const hit = list.find((x) => normName(x.name) === normName(e.name)) || list.find((x) => normName(x.name).endsWith(normName(e.name.split(" ").slice(-1)[0])) && normName(x.name)[0] === normName(e.name)[0]);
  const extra = { capNumber: e.cap, nationalityCode: e.nat, position: e.position, clubDebut: e.debut, previousClub: e.prev, captain: e.captain || undefined, squadSourceUrl: e.src };
  if (hit) Object.assign(hit, extra, { basis: "played-2026+wikipedia-squad" });
  else list.push({ playerId: players.find((p) => normName(p.name) === normName(e.name))?.id ?? null, name: e.name, ...extra, basis: "wikipedia-squad-only", sourceUrl: e.src });
}
const squads = CLUBS.filter((c) => c.status === "active").map((c) => ({ clubId: c.id, club: c.name, players: (byClub[c.id] || []).sort((a, b) => (b.apps2026 ?? -1) - (a.apps2026 ?? -1)) }));

// ---------------------------------------------------------------- clubs output
const legacy = JSON.parse(fs.readFileSync(path.join(ROOT, "data/nrl-clubs.json"), "utf8"));
const clubsOut = CLUBS.map((c) => {
  const lg = legacy.find((x) => x.id === c.id);
  const ss = [...new Set(seasonRows.filter((r) => r.codes.some((k) => c.codes.includes(k))).map((r) => r.season))].sort();
  return { id: c.id, name: c.name, shortName: c.short, nickname: c.nick, status: c.status, mergedInto: c.mergedInto ?? null, primaryColor: lg?.primaryColor ?? null, secondaryColor: lg?.secondaryColor ?? null, nrlSeasonsInDb: ss.length ? [ss[0], ss.at(-1)] : null, seasonsCount: ss.length, afltablesCodes: c.codes, note: c.note ?? null, sourceUrl: "https://afltables.com/rl/scorers/scorers_idx.html", coloursFrom: lg ? "data/nrl-clubs.json (existing scaffold)" : null };
});

// ---------------------------------------------------------------- honours
const honours = JSON.parse(fs.readFileSync(path.join(CACHE, "wikipedia/honours.json"), "utf8"));

// ---------------------------------------------------------------- write
fs.mkdirSync(OUT, { recursive: true });
const writeLines = (file, meta, key, arr) => fs.writeFileSync(path.join(OUT, file), `{\n${Object.entries(meta).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n")}\n  ${JSON.stringify(key)}: [\n${arr.map((x) => "    " + JSON.stringify(x)).join(",\n")}\n  ]\n}\n`);
const generatedAt = "2026-11-02";
writeLines("nrl-clubs.json", { about: "NRL clubs 1998-2026 (+ announced future clubs). Standalone reference; not used by the game.", generatedAt }, "clubs", clubsOut);
writeLines("nrl-players.json", { about: "Every player found on AFL Tables NRL season scorer pages 1998-2026, one row per person with per-season club rows (each season row is sourced by seasonSources[season].sourceUrl). Standalone; not used by the game.", generatedAt, seasonSources: seasonMeta, ambiguousSlugsLeftSeparate: ambiguous }, "players", players);
writeLines("nrl-current-squads-2026.json", { about: "2026 NRL squads. basis=played-2026: appeared in at least one 2026 premiership game (AFL Tables). Brisbane also merged with the Wikipedia 2026 season squad table (adds yet-to-debut squad members, positions, nationality codes). Development/Top-30 lists for other clubs not yet captured.", generatedAt, season: 2026 }, "clubs", squads.map((s) => ({ ...s, count: s.players.length })));
fs.writeFileSync(path.join(OUT, "nrl-honours.json"), JSON.stringify(honours, null, 2) + "\n");

const withDob = players.filter((p) => p.dateOfBirth).length;
console.log(JSON.stringify({ players: players.length, seasonRows: seasonRows.length, wikiMatched: wikiHits, withDob, ambiguous: ambiguous.length, squads: squads.map((s) => `${s.club}:${s.players.length}`) }, null, 1));
