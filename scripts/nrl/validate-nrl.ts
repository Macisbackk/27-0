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
if (errors.length) { console.error(`\n${errors.length} error(s):\n  ` + errors.join("\n  ")); process.exit(1); }
console.log("\nOK");
