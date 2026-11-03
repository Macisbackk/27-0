/**
 * Validate the standalone NRL database in data/nrl/ and print a coverage report.
 *   npx tsx scripts/nrl/validate-nrl.ts
 * Exits 1 on structural errors (coverage gaps are reported, not fatal).
 */
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve(__dirname, "../../data/nrl");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
const clubs: any[] = read("nrl-clubs.json").clubs;
const db = read("nrl-players.json");
const players: any[] = db.players;
const squads: any[] = read("nrl-current-squads-2026.json").clubs;
const honours = read("nrl-honours.json");

const errors: string[] = [];
const err = (m: string) => { if (errors.length < 50) errors.push(m); else if (errors.length === 50) errors.push("…more"); };
const clubIds = new Set(clubs.map((c) => c.id));
if (clubIds.size !== clubs.length) err("duplicate club ids");
for (const c of clubs) if (!c.sourceUrl) err(`club ${c.id} missing sourceUrl`);

const ids = new Set<string>();
const psc = new Set<string>();
for (const p of players) {
  if (!p.id || !/^nrl-[a-z0-9-]+$/.test(p.id)) err(`bad id ${p.id}`);
  if (ids.has(p.id)) err(`duplicate player id ${p.id}`);
  ids.add(p.id);
  if (!p.name) err(`${p.id} missing name`);
  if (!p.sources?.afltables) err(`${p.id} missing source`);
  if (p.dateOfBirth && !p.sources?.wikipedia) err(`${p.id} has DOB without wikipedia source`);
  if (!Array.isArray(p.seasons) || !p.seasons.length) err(`${p.id} has no seasons`);
  for (const s of p.seasons) {
    if (s.season < 1998 || s.season > 2026) err(`${p.id} season ${s.season} out of range`);
    for (const c of s.clubIds ?? [s.clubId]) if (!clubIds.has(c)) err(`${p.id} ${s.season} unknown club ${c}`);
    if (!db.seasonSources?.[s.season]?.sourceUrl) err(`${p.id} ${s.season} season has no source`);
    const key = `${p.id}|${s.season}|${(s.clubIds ?? [s.clubId]).join(",")}`;
    if (psc.has(key)) err(`duplicate person-season-club ${key}`);
    psc.add(key);
    if (!(s.apps >= 0)) err(`${p.id} ${s.season} bad apps`);
  }
}
for (const sq of squads) {
  if (!clubIds.has(sq.clubId)) err(`squad club ${sq.clubId} unknown`);
  for (const pl of sq.players) {
    if (pl.playerId && !ids.has(pl.playerId)) err(`squad ${sq.clubId} unknown player ${pl.playerId}`);
    if (!pl.sourceUrl) err(`squad ${sq.clubId} ${pl.name} missing source`);
  }
}
if (!honours.dallyMMedal?.sourceUrl) err("honours missing source");

// ---- honours / context files (build-nrl-honours.ts)
const exists = (f: string) => fs.existsSync(path.join(DIR, f));
const pidOk = (id: unknown, where: string) => { if (id !== null && id !== undefined && !ids.has(id as string)) err(`${where}: unknown player ${id}`); };
const needSrc = (x: any, where: string) => { if (!x?.sourceUrl || !/^https?:\/\//.test(x.sourceUrl)) err(`${where}: missing sourceUrl`); };
if (exists("nrl-grand-finals.json")) for (const g of read("nrl-grand-finals.json").grandFinals) {
  needSrc(g, `grand final ${g.season}`); pidOk(g.cliveChurchillMedal.playerId, `Clive Churchill ${g.season}`);
  if (!clubIds.has(g.premiersClubId)) err(`grand final ${g.season}: unknown premiers ${g.premiers}`);
}
if (exists("nrl-ladders.json")) for (const [y, l] of Object.entries<any>(read("nrl-ladders.json").seasons)) {
  needSrc(l, `ladder ${y}`);
  if (l.table.length !== l.teams) err(`ladder ${y}: ${l.table.length} rows for ${l.teams} teams`);
  for (const r of l.table) if (!clubIds.has(r.clubId)) err(`ladder ${y}: unknown club ${r.clubId}`);
}
if (exists("nrl-dally-m.json")) { const d = read("nrl-dally-m.json"); for (const m of d.medal) { needSrc(m, `Dally M ${m.season}`); pidOk(m.playerId, `Dally M ${m.season}`); } for (const t of d.teamOfTheYear) { needSrc(t, `TOTY ${t.season}`); for (const x of t.team) pidOk(x.playerId, `TOTY ${t.season}`); } }
if (exists("nrl-origin.json")) { const o = read("nrl-origin.json"); for (const s of o.series) { needSrc(s, `Origin ${s.season}`); pidOk(s.wallyLewisMedal.playerId, `Wally Lewis ${s.season}`); } for (const x of o.players) { needSrc(x, `Origin player ${x.name}`); pidOk(x.playerId, `Origin player ${x.name}`); } }
for (const [f, key] of [["nrl-golden-boot.json", "winners"], ["nrl-hall-of-fame.json", "hallOfFame"], ["nrl-hall-of-fame.json", "immortals"], ["nrl-test-players.json", "testDebuts"], ["nrl-test-players.json", "tournamentSquads"]] as const)
  if (exists(f)) for (const x of read(f)[key]) { needSrc(x, `${f} ${x.name}`); pidOk(x.playerId, `${f} ${x.name}`); }

// ---- card info (build-nrl-card-info.ts)
let cardInfo: any[] = [];
if (exists("nrl-card-info.json")) {
  cardInfo = read("nrl-card-info.json").players;
  const POS = new Set(["FB", "WG", "CE", "SO", "SH", "PR", "HK", "SR", "LF"]);
  for (const r of cardInfo) {
    if (!ids.has(r.id)) err(`card info: unknown player ${r.id}`);
    for (const [k, v] of Object.entries(r)) {
      if (["id", "name", "slugName", "honours", "fieldSources", "originDebut", "secondaryPositions", "birthYear", "primaryPosition", "representativeNation", "nationality"].includes(k)) continue;
      if (v !== null && v !== undefined && !(Array.isArray(v) && !v.length) && !r.fieldSources?.[k]) err(`card info ${r.id}: ${k} has no source`);
    }
    if (r.nationality && !r.fieldSources.nationality) err(`card info ${r.id}: nationality has no source`);
    if (r.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(r.dateOfBirth)) err(`card info ${r.id}: bad DOB ${r.dateOfBirth}`);
    if (r.birthYear && (r.birthYear < 1950 || r.birthYear > 2010)) err(`card info ${r.id}: birth year ${r.birthYear}`);
    for (const pos of r.positions ?? []) if (!POS.has(pos)) err(`card info ${r.id}: bad position ${pos}`);
    if (r.heightCm && (r.heightCm < 160 || r.heightCm > 210)) err(`card info ${r.id}: height ${r.heightCm}`);
    if (r.weightKg && (r.weightKg < 60 || r.weightKg > 140)) err(`card info ${r.id}: weight ${r.weightKg}`);
    for (const h of r.honours) if (!h.source) err(`card info ${r.id}: honour without source`);
  }
}

// ---- ratings (build-nrl-ratings.ts)
if (exists("nrl-ratings.json")) {
  const R = read("nrl-ratings.json");
  const seen = new Set<string>();
  for (const s of R.seasons) {
    if (!ids.has(s.playerId)) err(`rating: unknown player ${s.playerId}`);
    if (!(s.rating >= 80 && s.rating <= 99)) err(`rating ${s.playerId} ${s.season}: ${s.rating} outside 80-99`);
    if (!s.why) err(`rating ${s.playerId} ${s.season}: no reason`);
    const k = `${s.playerId}|${s.season}`; if (seen.has(k)) err(`duplicate rating ${k}`); seen.add(k);
  }
  for (const p of players) for (const s of p.seasons) if (s.season < 2026 && !seen.has(`${p.id}|${s.season}`)) err(`no rating for ${p.id} ${s.season}`);
}
if (exists("nrl-ratings-2026.json")) {
  const C = read("nrl-ratings-2026.json").players;
  const squadCount = squads.reduce((a, s) => a + s.players.length, 0);
  if (C.length !== squadCount) err(`2026 ratings: ${C.length} rows for ${squadCount} squad players`);
  for (const c of C) { if (c.playerId && !ids.has(c.playerId)) err(`2026 rating: unknown player ${c.playerId}`); if (!(c.rating >= 70 && c.rating <= 99)) err(`2026 rating ${c.name}: ${c.rating} outside 70-99`); }
}

// ---- coverage report
const pct = (n: number) => `${((100 * n) / players.length).toFixed(1)}%`;
const csCount: Record<string, number> = {};
for (const p of players) for (const s of p.seasons) for (const c of s.clubIds ?? [s.clubId]) { const k = `${s.season}|${c}`; csCount[k] = (csCount[k] || 0) + 1; }
const decades: Record<string, Set<string>> = {};
for (const p of players) for (const s of p.seasons) { const d = s.season < 2000 ? "1998-1999" : `${Math.floor(s.season / 10) * 10}s`; (decades[d] ||= new Set()).add(p.id); }
console.log("NRL DB coverage");
console.log(`  players: ${players.length}   season rows: ${players.reduce((a, p) => a + p.seasons.length, 0)}`);
console.log(`  with DOB: ${players.filter((p) => p.dateOfBirth).length} (${pct(players.filter((p) => p.dateOfBirth).length)})  with representative/nationality info: ${players.filter((p) => p.representative).length} (${pct(players.filter((p) => p.representative).length)})  with positions: ${pct(players.filter((p) => p.positions).length)}  with height: ${pct(players.filter((p) => p.heightCm).length)}  with per-season stats: 100%`);
console.log(`  players by decade: ${Object.entries(decades).map(([d, s]) => `${d}=${s.size}`).join("  ")}`);
const thin = Object.entries(csCount).filter(([, n]) => n < 18).map(([k, n]) => `${k}:${n}`);
console.log(`  club-seasons: ${Object.keys(csCount).length}; min/avg players per club-season: ${Math.min(...Object.values(csCount))}/${(Object.values(csCount).reduce((a, b) => a + b, 0) / Object.keys(csCount).length).toFixed(1)}`);
if (thin.length) console.log(`  thin club-seasons (<18 players listed): ${thin.join(" ")}`);
console.log(`  2026 squads: ${squads.map((s) => `${s.club}=${s.players.length}`).join(", ")}`);
console.log(`  ambiguous slugs left separate: ${db.ambiguousSlugsLeftSeparate?.length ?? 0}`);
if (cardInfo.length) {
  const cov = (f: string) => `${((100 * cardInfo.filter((r) => r[f] !== null && r[f] !== undefined && !(Array.isArray(r[f]) && !r[f].length)).length) / cardInfo.length).toFixed(1)}%`;
  console.log(`  card info: DOB ${cov("dateOfBirth")}, birth year/range ${((100 * cardInfo.filter((r) => r.birthYear || r.birthYearRange).length) / cardInfo.length).toFixed(1)}%, nationality ${cov("nationality")}, position ${cov("primaryPosition")}, debut ${cov("nrlDebutYear")}, height ${cov("heightCm")}, Origin ${cov("stateOfOrigin")}`);
}
if (errors.length) { console.error(`\n${errors.length} error(s):\n  ` + errors.join("\n  ")); process.exit(1); }
console.log("\nOK");
