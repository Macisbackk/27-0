/**
 * Card info for every NRL player: the fields a player card needs, each with its source.
 *
 *   bun scripts/nrl/build-nrl-honours.ts   (first: resolves honours to player ids)
 *   bun scripts/nrl/build-nrl-card-info.ts
 *
 * Reads data/nrl/nrl-players.json (+ the honours files) and the committed caches:
 *   cache/bios/wikipedia-players.txt     player-article infoboxes (DOB, birthplace, height, weight, positions, debut, Origin, Tests)
 *   cache/bios/squad-ages-positions.txt  2023 Pacific Championships squad tables (age, positions)
 *   cache/rlp/2026-*.txt                 Rugby League Project 2026 club pages (age, birthplace, representative teams)
 *   cache/squads-2026/*.txt              2026 Top-30 / development lists
 * Writes:
 *   data/nrl/nrl-card-info.json          one record per player (fields null when no source has them — never guessed)
 *   data/nrl/nrl-current-squads-2026.json  adds squad-list members who have not played a 2026 game (basis "squad-list")
 *   data/nrl/nrl-players.json            name spelling fixes (apostrophes) with nameSource "corrected"
 * Standalone: nothing in src/ reads these.
 */
import fs from "node:fs";
import path from "node:path";
import { DATA, CACHE, readJson, readCache, firstUrl, headerValue, makeResolver, normName, toPosCode, clubIdFromName, writeLinesJson, type NrlPlayer } from "./lib";

const GEN = "2026-11-03";
const db = readJson("nrl-players.json");
const players: NrlPlayer[] = db.players;
const byId = new Map(players.map((p) => [p.id, p]));
const { resolve } = makeResolver(players);

type Src = { value: unknown; source: string };
type Rec = Record<string, any> & { fieldSources: Record<string, string> };
const recs = new Map<string, Rec>();
const rec = (id: string) => recs.get(id)!;
const set = (id: string, field: string, value: unknown, source: string, overwrite = false) => {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return;
  const r = rec(id);
  if (r[field] !== null && r[field] !== undefined && !overwrite) return;
  r[field] = value;
  r.fieldSources[field] = source;
};

const NATION_ALIASES: Record<string, string> = { NZL: "New Zealand", AUS: "Australia", TGA: "Tonga", TON: "Tonga", SAM: "Samoa", WSM: "Samoa", FIJ: "Fiji", PNG: "Papua New Guinea", COK: "Cook Islands", ENG: "England", LBN: "Lebanon", ITA: "Italy" };
const NATIONS = ["Australia", "New Zealand", "Tonga", "Samoa", "Fiji", "Papua New Guinea", "Cook Islands", "England", "Great Britain", "Lebanon", "Italy", "Scotland", "Ireland", "Wales", "France", "Greece", "United States", "Jamaica", "Malta", "Serbia", "Russia", "Niue", "Philippines"];
const cleanNations = (list: string[]) => [...new Set(list.map((s) => s.trim()).filter((s) => NATIONS.includes(s)))];

// ---------------------------------------------------------------- base records (existing Wikipedia-cache bio from build-nrl-db)
for (const p of players) {
  const slugName = p.slugName ?? p.name;
  const r: Rec = {
    id: p.id, name: p.name, slugName, dateOfBirth: null, birthYear: null, birthYearRange: null, birthPlace: null,
    nationality: null, representativeNation: null, positions: null, primaryPosition: null, secondaryPositions: null,
    nrlDebutYear: null, heightCm: null, weightKg: null, stateOfOrigin: null, internationalTeams: null,
    honours: [], fieldSources: {},
  };
  recs.set(p.id, r);
  const w = p.sources?.wikipedia;
  if (w) {
    set(p.id, "dateOfBirth", p.dateOfBirth, w);
    set(p.id, "birthPlace", p.birthPlace, w);
    set(p.id, "heightCm", p.heightCm, w);
    set(p.id, "weightKg", p.weightKg, w);
    if (p.positions) set(p.id, "positions", p.positions.map((x: string) => toPosCode(x)).filter(Boolean), w);
    set(p.id, "stateOfOrigin", p.stateOfOrigin === "New South Wales" ? "NSW" : p.stateOfOrigin === "Queensland" ? "QLD" : null, w);
    set(p.id, "internationalTeams", cleanNations(p.internationalTeams ?? []), w);
  }
  // NRL debut: the database starts in 1998, so only a first season after 1998 is a debut year.
  if (p.firstSeason > 1998) set(p.id, "nrlDebutYear", p.firstSeason, p.sources.afltables);
}

// ---------------------------------------------------------------- display names (apostrophes etc.) from every named source
const displayNames: { name: string; id: string; source: string }[] = [];
const noteName = (name: string | null | undefined, id: string | null | undefined, source: string) => { if (name && id) displayNames.push({ name, id, source }); };

// ---------------------------------------------------------------- Wikipedia player articles
const bios = readCache("bios/wikipedia-players.txt");
const unresolvedBios: string[] = [];
for (const [name, url, dob, place, h, w, pos, debut, origin, intl] of bios.rows) {
  const year = dob ? Math.min(2026, +dob.slice(0, 4) + 24) : undefined;
  const p = resolve(name!, { year: debut ? Math.max(+debut, 1998) : year, window: 30 });
  if (!p) { unresolvedBios.push(name!); continue; }
  noteName(name, p.id, url!);
  set(p.id, "dateOfBirth", dob, url!, true);
  set(p.id, "birthPlace", place, url!, true);
  set(p.id, "heightCm", h ? +h : null, url!, true);
  set(p.id, "weightKg", w ? +w : null, url!, true);
  const codes = (pos ?? "").split(";").map((x) => toPosCode(x)).filter(Boolean);
  set(p.id, "positions", [...new Set(codes)], url!, true);
  if (debut && +debut <= 1998 && p.firstSeason === 1998) set(p.id, "nrlDebutYear", +debut, url!);
  set(p.id, "stateOfOrigin", origin === "New South Wales" ? "NSW" : origin === "Queensland" ? "QLD" : null, url!, true);
  set(p.id, "internationalTeams", cleanNations((intl ?? "").split(";")), url!, true);
}

// ---------------------------------------------------------------- tournament squad tables (age + positions)
const sq = readCache("bios/squad-ages-positions.txt");
const SQ_SRC: Record<string, string> = { "2023": "https://en.wikipedia.org/wiki/2023_Rugby_League_Pacific_Championships_squads" };
const ageRange = (age: number, asOf: number, monthOfSnapshot: number) =>
  // age on a date in month m of year Y: born in Y-age (birthday already passed) or Y-age-1
  monthOfSnapshot >= 12 ? [asOf - age, asOf - age] : [asOf - age - 1, asOf - age];
const addRange = (id: string, range: number[], source: string) => {
  const r = rec(id);
  if (r.dateOfBirth) return;
  const cur = r.birthYearRange as number[] | null;
  const next = cur ? [Math.max(cur[0]!, range[0]!), Math.min(cur[1]!, range[1]!)] : range;
  if (next[0]! > next[1]!) return; // sources disagree: keep the first
  r.birthYearRange = next;
  r.fieldSources.birthYearRange = cur ? `${r.fieldSources.birthYearRange}; ${source}` : source;
};
for (const [nation, name, age, pos, club, yr] of sq.rows) {
  const p = resolve(name!, { year: +yr!, clubId: clubIdFromName(club!), window: 1 });
  if (!p) continue;
  const src = SQ_SRC[yr!]!;
  noteName(name, p.id, src);
  if (age) addRange(p.id, ageRange(+age, +yr!, 10), src);
  const codes = pos!.split(",").map((x) => toPosCode(x)).filter(Boolean);
  set(p.id, "positions", codes, src);
  if (!/ A$/.test(nation!)) set(p.id, "internationalTeams", [nation], src);
}

// ---------------------------------------------------------------- Rugby League Project 2026 club pages
const rlpDir = path.join(CACHE, "rlp");
const rlpSquads: { clubId: string; name: string; id: string | null; source: string }[] = [];
for (const f of fs.readdirSync(rlpDir).filter((x) => x.endsWith(".txt"))) {
  const c = readCache(`rlp/${f}`);
  const clubId = headerValue(c.header, "club")!;
  const src = firstUrl(c.header)!;
  for (const [sf, age, born, rep] of c.rows) {
    const [sur, first] = sf!.split(",").map((s) => s.trim());
    const name = `${first} ${sur}`;
    const p = resolve(name, { year: 2026, clubId, window: 1 });
    rlpSquads.push({ clubId, name, id: p?.id ?? null, source: src });
    if (!p) continue;
    noteName(name, p.id, src);
    if (age) addRange(p.id, ageRange(+age, 2026, 3), src); // page snapshot from about March 2026
    set(p.id, "birthPlace", born || null, src);
    const reps = (rep ?? "").split(";");
    if (reps.includes("New South Wales")) set(p.id, "stateOfOrigin", "NSW", src);
    if (reps.includes("Queensland")) set(p.id, "stateOfOrigin", "QLD", src);
    const nat = cleanNations(reps);
    if (nat.length) {
      const r = rec(p.id);
      r.internationalTeams = [...new Set([...(r.internationalTeams ?? []), ...nat])];
      r.fieldSources.internationalTeams ??= src;
    }
  }
}

// ---------------------------------------------------------------- honours files → Origin / Tests / positions / honours tags
const dm = readJson("nrl-dally-m.json");
const posVotes = new Map<string, Map<string, number>>();
for (const t of dm.teamOfTheYear) for (const x of t.team) {
  if (!x.playerId || x.position === "IC") continue;
  noteName(x.name, x.playerId, t.sourceUrl);
  const m = posVotes.get(x.playerId) ?? new Map();
  m.set(x.position, (m.get(x.position) ?? 0) + 1);
  posVotes.set(x.playerId, m);
  rec(x.playerId).honours.push({ award: "Dally M Team of the Year", season: t.season, position: x.position, source: t.sourceUrl });
}
for (const [id, m] of posVotes) {
  const codes = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  set(id, "positions", codes, "https://en.wikipedia.org/wiki/List_of_Dally_M_Awards_winners (positional awards)");
}
for (const m of dm.medal) if (m.playerId) { noteName(m.name, m.playerId, m.sourceUrl); rec(m.playerId).honours.push({ award: "Dally M Medal", season: m.season, source: m.sourceUrl }); }
for (const g of readJson("nrl-grand-finals.json").grandFinals) {
  if (g.cliveChurchillMedal.playerId) rec(g.cliveChurchillMedal.playerId).honours.push({ award: "Clive Churchill Medal", season: g.season, source: g.sourceUrl });
}
for (const g of readJson("nrl-golden-boot.json").winners) if (g.playerId) rec(g.playerId).honours.push({ award: "Golden Boot", season: g.season, source: g.sourceUrl });
const origin = readJson("nrl-origin.json");
for (const s of origin.series) if (s.wallyLewisMedal.playerId) rec(s.wallyLewisMedal.playerId).honours.push({ award: "Wally Lewis Medal", season: s.season, source: s.sourceUrl });
for (const o of origin.players) if (o.playerId) {
  noteName(o.name, o.playerId, o.sourceUrl);
  set(o.playerId, "stateOfOrigin", o.side, o.sourceUrl);
  rec(o.playerId).originDebut ??= o.debut;
}
const hof = readJson("nrl-hall-of-fame.json");
for (const h of hof.hallOfFame) if (h.playerId) rec(h.playerId).honours.push({ award: "NRL Hall of Fame", season: h.inducted, source: h.sourceUrl });
for (const h of hof.immortals) if (h.playerId) rec(h.playerId).honours.push({ award: "Immortal", season: h.named, source: h.sourceUrl });
const tests = readJson("nrl-test-players.json");
const addIntl = (id: string, nation: string, src: string, year: number) => {
  const r = rec(id);
  r.internationalTeams = [...new Set([...(r.internationalTeams ?? []), nation])];
  r.fieldSources.internationalTeams ??= src;
  r._intlYears ??= {};
  r._intlYears[nation] = Math.max(r._intlYears[nation] ?? 0, year);
};
for (const t of tests.testDebuts) if (t.playerId) { addIntl(t.playerId, t.nation, t.sourceUrl, t.debut); if (t.nation !== "Australia") noteName(t.name, t.playerId, t.sourceUrl); }
for (const t of tests.tournamentSquads) if (t.playerId) { addIntl(t.playerId, t.nation, t.sourceUrl, t.year); noteName(t.name, t.playerId, t.sourceUrl); }

// ---------------------------------------------------------------- 2026 squad lists → squads file + names
const squadsFile = readJson("nrl-current-squads-2026.json");
const sqDir = path.join(CACHE, "squads-2026");
const listed: { clubId: string; name: string; tags: string[]; source: string }[] = [];
for (const f of fs.readdirSync(sqDir).filter((x) => x.endsWith(".txt"))) {
  const c = readCache(`squads-2026/${f}`);
  const clubId = headerValue(c.header, "club")!;
  const src = firstUrl(c.header)!;
  for (const [name, ...tags] of c.rows) listed.push({ clubId, name: name!, tags, source: src });
}
for (const r of rlpSquads) listed.push({ clubId: r.clubId, name: r.name, tags: [], source: r.source });
let added = 0;
const squadCoverage: Record<string, string> = {};
for (const club of squadsFile.clubs) {
  club.players = club.players.filter((x: any) => !String(x.basis).startsWith("squad-list"));
  const fromLists = listed.filter((l) => l.clubId === club.clubId);
  squadCoverage[club.clubId] = fromLists.length ? [...new Set(fromLists.map((l) => l.source))].join(" + ") : "played-2026 only (no Top-30 list found)";
  for (const l of fromLists) {
    if (l.tags.includes("departing")) continue;
    const p = resolve(l.name, { year: 2026, clubId: club.clubId, window: 1 }) ?? resolve(l.name);
    if (p) noteName(l.name, p.id, l.source);
    const have = club.players.find((x: any) => (p && x.playerId === p.id) || normName(x.name) === normName(l.name));
    if (have) { if (l.tags.includes("captain")) have.captain = true; if (l.tags.includes("dev")) have.developmentList = true; continue; }
    club.players.push({ playerId: p?.id ?? null, name: l.name, apps2026: 0, basis: "squad-list (no 2026 NRL game found)", developmentList: l.tags.includes("dev") || undefined, captain: l.tags.includes("captain") || undefined, sourceUrl: l.source, nrlDebutSeason: p?.firstSeason ?? null });
    added++;
  }
  club.count = club.players.length;
}

// ---------------------------------------------------------------- name fixes
const nameFixes: { id: string; from: string; to: string; source: string }[] = [];
for (const p of players) {
  if (p.nameSource !== "afltables-slug" && p.nameSource !== "corrected") continue;
  const slugName = p.slugName ?? p.name;
  const cand = displayNames.filter((d) => d.id === p.id && normName(d.name) === normName(slugName) && d.name !== slugName && /['’\-éè]/.test(d.name));
  let to: string | null = null, source = "";
  if (cand.length) { to = cand[0]!.name.replace(/’/g, "'"); source = cand[0]!.source; }
  else if (/\bO[A-Z][a-z]/.test(slugName)) { to = slugName.replace(/\bO([A-Z][a-z])/g, "O'$1"); source = "rule: Irish O' surname written without the apostrophe in the AFL Tables slug"; }
  if (to && to !== slugName) {
    nameFixes.push({ id: p.id, from: slugName, to, source });
    p.slugName = slugName; p.name = to; p.nameSource = "corrected";
    const r = rec(p.id); r.name = to; r.fieldSources.name = source;
  }
}

// ---------------------------------------------------------------- finalise
for (const r of recs.values()) {
  if (r.dateOfBirth) { r.birthYear = +String(r.dateOfBirth).slice(0, 4); r.fieldSources.birthYear = r.fieldSources.dateOfBirth; r.birthYearRange = null; delete r.fieldSources.birthYearRange; }
  else if (r.birthYearRange && r.birthYearRange[0] === r.birthYearRange[1]) { r.birthYear = r.birthYearRange[0]; r.fieldSources.birthYear = r.fieldSources.birthYearRange; }
  if (r.positions?.length) { r.primaryPosition = r.positions[0]; r.secondaryPositions = r.positions.slice(1); r.fieldSources.primaryPosition = r.fieldSources.positions; }
  if (r.internationalTeams?.length) {
    // nation he represents in Tests: the most recent one we have a year for, else the last listed (infobox order is chronological)
    const yrs = r._intlYears ?? {};
    const sorted = [...r.internationalTeams].sort((a: string, b: string) => (yrs[b] ?? 0) - (yrs[a] ?? 0));
    r.representativeNation = Object.keys(yrs).length ? sorted[0] : r.internationalTeams.at(-1);
    r.fieldSources.representativeNation = r.fieldSources.internationalTeams;
    r.nationality = r.representativeNation;
    r.fieldSources.nationality = `${r.fieldSources.internationalTeams} (Test nation)`;
  }
  delete r._intlYears;
  r.honours.sort((a: any, b: any) => a.season - b.season);
}
// Brisbane 2026 squad table nationality codes
for (const club of squadsFile.clubs) for (const x of club.players) if (x.playerId && x.nationalityCode && !rec(x.playerId).nationality) {
  const n = NATION_ALIASES[x.nationalityCode];
  if (n) { rec(x.playerId).nationality = n; rec(x.playerId).fieldSources.nationality = `${x.squadSourceUrl} (squad table nationality)`; }
  const code = toPosCode(x.position);
  if (code) set(x.playerId, "positions", [code], x.squadSourceUrl);
}
for (const r of recs.values()) if (r.positions?.length && !r.primaryPosition) { r.primaryPosition = r.positions[0]; r.secondaryPositions = r.positions.slice(1); r.fieldSources.primaryPosition = r.fieldSources.positions; }

const out = [...recs.values()].sort((a, b) => a.id.localeCompare(b.id));
writeLinesJson("nrl-card-info.json", {
  about: "Card info for every NRL player (standalone, not used by the game). Every non-null field names its source in fieldSources. Positions use the game's codes (FB WG CE SO SH PR HK SR LF); positions[0] is the primary. nationality = the nation he has played Tests for (most recent), else a squad-table nationality; null otherwise. birthYearRange [from,to] is given when only an age is known (an age on a known date leaves two possible birth years). nrlDebutYear is the first season in the database when after 1998 (the database starts in 1998), or the article's debut year for 1998 starters.",
  generatedAt: GEN,
  nameFixes,
  unresolvedBioRows: unresolvedBios,
}, "players", out);
writeLinesJson("nrl-players.json", { about: db.about, generatedAt: db.generatedAt, seasonSources: db.seasonSources, ambiguousSlugsLeftSeparate: db.ambiguousSlugsLeftSeparate }, "players", players);
squadsFile.about = "2026 NRL squads. basis=played-2026: appeared in at least one 2026 premiership game (AFL Tables). basis=squad-list: named on a 2026 Top-30 / development list (rugbyleaguezone / Zero Tackle / club site, Nov-Dec 2025) or the club's Rugby League Project 2026 page, with no 2026 NRL game found. squadSources says which lists exist per club.";
squadsFile.squadSources = squadCoverage;
writeLinesJson("nrl-current-squads-2026.json", { about: squadsFile.about, generatedAt: GEN, season: 2026, squadSources: squadCoverage }, "clubs", squadsFile.clubs);

// ---------------------------------------------------------------- coverage report
const pri = (p: NrlPlayer) => p.lastSeason === 2026 || p.seasons.reduce((a, s) => a + s.apps, 0) >= 50 || rec(p.id).honours.length > 0;
const fields = ["dateOfBirth", "birthYear|birthYearRange", "birthPlace", "nationality", "primaryPosition", "nrlDebutYear", "heightCm", "weightKg", "stateOfOrigin", "internationalTeams"];
const has = (r: Rec, f: string) => f.split("|").some((k) => r[k] !== null && r[k] !== undefined && !(Array.isArray(r[k]) && !r[k].length));
const report: Record<string, string> = {};
for (const f of fields) {
  const all = out.filter((r) => has(r, f)).length;
  const pp = players.filter(pri);
  const pr = pp.filter((p) => has(rec(p.id), f)).length;
  report[f] = `all ${all}/${out.length} (${((100 * all) / out.length).toFixed(1)}%) · priority ${pr}/${pp.length} (${((100 * pr) / pp.length).toFixed(1)}%)`;
}
console.log(JSON.stringify({ nameFixes: nameFixes.length, squadListAdded: added, unresolvedBios, coverage: report }, null, 1));
