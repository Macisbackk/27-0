/**
 * Re-date era cards that sit in a season the player wasn't at that club.
 *
 * Many single-season cards were dated from the player's career start (e.g. a Salford
 * card for 1986 when he played for Salford in 1997–98), so the card showed the wrong
 * age and a club-year that never happened. The verified squad lists (RLP starting 17s,
 * Wikipedia/manual XIIIs and the playable team-year rosters) tell us which seasons each
 * player actually turned out for each club; a card more than a season away from all of
 * them is moved to the nearest verified season that doesn't already have its own card.
 *
 * If every verified season already has its own card, the misdated one is a duplicate
 * and is hidden from the game instead.
 *
 * Skips: cards whose id carries a year (those were placed deliberately), ids listed in
 * --skip-file (researched fixes win), and moves that would make the age implausible.
 *
 * Run: bun scripts/fix-era-card-years.ts [--apply] [--skip-file=path.json ...]
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

type Row = Record<string, unknown> & { id: string; name: string; club: string };

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");
const read = <T>(f: string): T => JSON.parse(readFileSync(join(DATA, f), "utf8")) as T;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const apply = process.argv.includes("--apply");
const skipIds = new Set<string>();
for (const arg of process.argv.filter((a) => a.startsWith("--skip-file="))) {
  const skip = JSON.parse(readFileSync(arg.split("=")[1]!, "utf8")) as { cardFixes?: { id: string }[]; fixes?: { id: string }[] };
  for (const f of [...(skip.cardFixes ?? []), ...(skip.fixes ?? [])]) skipIds.add(f.id);
}

const historic = read<Row[]>("historic-players.json");
const legends = read<Row[]>("legends.json");
const all = [...historic, ...legends];
const byId = new Map(all.map((p) => [p.id, p]));

// Verified (club, player) → seasons.
const verified = new Map<string, Set<number>>();
const see = (club: string, name: string, year: number) => {
  const key = `${club}|${norm(name)}`;
  if (!verified.has(key)) verified.set(key, new Set());
  verified.get(key)!.add(year);
};
for (const e of read<{ club: string; year: number; squad: { name: string }[] }[]>("era-starting-17s.json")) {
  for (const m of e.squad) see(e.club, m.name, Number(e.year));
}
for (const f of ["era-wikipedia-squads.json", "sl-era-verified-squads.json"]) {
  for (const [club, years] of Object.entries(read<Record<string, Record<string, { wikipediaPlayers?: string[] }>>>(f))) {
    for (const [y, entry] of Object.entries(years)) for (const n of entry.wikipediaPlayers ?? []) see(club, n, Number(y));
  }
}
for (const [club, years] of Object.entries(read<Record<string, Record<string, string[]>>>("team-year-rosters.json"))) {
  for (const [y, ids] of Object.entries(years)) {
    for (const id of ids) {
      const p = byId.get(id);
      if (p) see(club, p.name, Number(y));
    }
  }
}

// Seasons that already have a card for this person at this club.
const carded = new Map<string, Set<number>>();
for (const p of all) {
  const y = p.cardYear as number | undefined;
  if (!y) continue;
  const key = `${p.club}|${norm(p.name)}`;
  if (!carded.has(key)) carded.set(key, new Set());
  carded.get(key)!.add(y);
}

const birthYearOf = (p: Row): number | undefined => {
  if (typeof p.birthYear === "number") return p.birthYear;
  const m = typeof p.dateOfBirth === "string" ? p.dateOfBirth.match(/^(\d{4})/) : null;
  return m ? Number(m[1]) : undefined;
};

type Move = { id: string; name: string; club: string; from: number; to: number; verifiedSeasons: number[]; ageThen?: number; ageNow?: number };
const moves: Move[] = [];
const skipped: { id: string; reason: string }[] = [];
const hidden: { id: string; name: string; club: string; year: number; verifiedSeasons: number[] }[] = [];

for (const p of all) {
  const year = p.cardYear as number | undefined;
  if (!year) continue;
  const key = `${p.club}|${norm(p.name)}`;
  const seasons = verified.get(key);
  if (!seasons || seasons.has(year)) continue;
  const nearestAny = [...seasons].sort((a, b) => Math.abs(a - year) - Math.abs(b - year) || a - b)[0]!;
  if (Math.abs(nearestAny - year) < 2) continue; // within a season: fine
  if (/-\d{4}$/.test(p.id)) {
    skipped.push({ id: p.id, reason: "year in card id" });
    continue;
  }
  if (skipIds.has(p.id)) {
    skipped.push({ id: p.id, reason: "researched fix supplied" });
    continue;
  }
  const taken = carded.get(key) ?? new Set<number>();
  const options = [...seasons].filter((y) => !taken.has(y)).sort((a, b) => Math.abs(a - year) - Math.abs(b - year) || a - b);
  const to = options[0];
  if (to === undefined) {
    // A correctly dated card already exists for every season he played there: this
    // misdated copy is a duplicate, so take it out of the game (it stays in byId for saves).
    hidden.push({ id: p.id, name: p.name, club: p.club, year, verifiedSeasons: [...seasons].sort() });
    continue;
  }
  const born = birthYearOf(p);
  const ageNow = born !== undefined ? to - born : undefined;
  if (ageNow !== undefined && (ageNow < 16 || ageNow > 40)) {
    skipped.push({ id: p.id, reason: `age at ${to} would be ${ageNow} (same-name player?)` });
    continue;
  }
  moves.push({ id: p.id, name: p.name, club: p.club, from: year, to, verifiedSeasons: [...seasons].sort(), ageThen: born !== undefined ? year - born : undefined, ageNow });
  taken.add(to);
  carded.set(key, taken);
}

if (apply) {
  const moveById = new Map(moves.map((m) => [m.id, m]));
  const hideIds = new Set(hidden.map((h) => h.id));
  for (const [file, rows] of [["historic-players.json", historic], ["legends.json", legends]] as const) {
    let changed = 0;
    for (const p of rows) {
      if (hideIds.has(p.id) && p.availableInGame !== false) {
        p.availableInGame = false;
        changed++;
        continue;
      }
      const m = moveById.get(p.id);
      if (!m) continue;
      p.year = m.to;
      p.cardYear = m.to;
      p.yearsActive = `${m.to}–${m.to}`;
      p.teamYearId = `${slug(String(p.club))}-${m.to}`;
      changed++;
    }
    if (changed > 0) writeFileSync(join(DATA, file), `${JSON.stringify(rows, null, 2)}\n`);
    console.log(`${file}: changed ${changed} cards`);
  }
}

writeFileSync(
  join(DATA, "era-card-year-fix-report.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), script: "scripts/fix-era-card-years.ts", applied: apply, moved: moves.length, hiddenDuplicates: hidden.length, skippedCount: skipped.length, moves, hidden, skipped }, null, 2)}\n`
);
console.log(`Cards to re-date: ${moves.length} | misdated duplicates to hide: ${hidden.length} | skipped: ${skipped.length}${apply ? " (applied)" : " (dry run)"}`);
