/**
 * Compare Fantasy Super League 2026 roster vs current-squads SL playable pool.
 * Focus on players with minutes (appeared in 2026 season).
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const FANTASY = join(ROOT, "data/imports/fantasy-super-league-players-2026.md");
const CURRENT = join(ROOT, "data/current-squads.json");
const SL_SQUADS = join(ROOT, "data/sl-2026-squads.json");
const OUT = join(ROOT, "data/fantasy-vs-current-2026-audit.json");

const SL = new Set([
  "Bradford Bulls",
  "Castleford Tigers",
  "Catalans Dragons",
  "Huddersfield Giants",
  "Hull FC",
  "Hull KR",
  "Leeds Rhinos",
  "Leigh Leopards",
  "St Helens",
  "Toulouse Olympique",
  "Wakefield Trinity",
  "Warrington Wolves",
  "Wigan Warriors",
  "York Knights",
]);

const POS_SUFFIXES = [
  "Full Back",
  "Winger",
  "Centre",
  "Stand Off",
  "Scrum Half",
  "Prop",
  "Hooker",
  "Second Row",
  "Loose Forward",
];

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripPos(raw: string): { name: string; pos: string | null } {
  let name = raw.trim();
  for (const pos of POS_SUFFIXES) {
    if (name.endsWith(pos)) {
      return { name: name.slice(0, -pos.length).trim(), pos };
    }
  }
  return { name, pos: null };
}

type FantasyRow = {
  name: string;
  pos: string | null;
  minutes: number;
  score: number;
};

function loadFantasy(): FantasyRow[] {
  const text = readFileSync(FANTASY, "utf8");
  const rows: FantasyRow[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*\|\s*([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (!m) continue;
    const cell = m[1].trim();
    if (!cell || cell === "Name" || cell.startsWith("--")) continue;
    const { name, pos } = stripPos(cell);
    if (name.length < 3) continue;
    const minutes = Number(String(m[4]).trim()) || 0;
    const score = Number(String(line.split("|").slice(-2)[0]).trim()) || 0;
    rows.push({ name, pos, minutes, score });
  }
  return rows;
}

type Cur = {
  id: string;
  name: string;
  club: string;
  availableInGame?: boolean;
  peakRating?: number;
};

function main() {
  const fantasy = loadFantasy();
  const current = JSON.parse(readFileSync(CURRENT, "utf8")) as Cur[];
  const slSquads = JSON.parse(readFileSync(SL_SQUADS, "utf8")) as Record<
    string,
    { name: string }[]
  >;

  const currentByNorm = new Map<string, Cur[]>();
  for (const p of current) {
    const k = norm(p.name);
    const list = currentByNorm.get(k) ?? [];
    list.push(p);
    currentByNorm.set(k, list);
  }

  const firstTeamNorm = new Set<string>();
  for (const rows of Object.values(slSquads)) {
    for (const r of rows) firstTeamNorm.add(norm(r.name));
  }

  const appeared = fantasy.filter((r) => r.minutes > 0);
  const missingAppeared: FantasyRow[] = [];
  const missingFirstTeamOnly: FantasyRow[] = [];
  const inDbNotFirstTeam: Array<{ name: string; clubs: string[] }> = [];

  for (const row of appeared) {
    const hits = currentByNorm.get(norm(row.name)) ?? [];
    const slHits = hits.filter((h) => SL.has(h.club) && h.availableInGame !== false);
    if (slHits.length === 0) {
      missingAppeared.push(row);
      if (!firstTeamNorm.has(norm(row.name))) {
        // also not in authoritative first-team json
      }
    }
  }

  // Fantasy players with significant minutes missing from DB entirely
  const highMinutesMissing = missingAppeared
    .filter((r) => r.minutes >= 200)
    .sort((a, b) => b.minutes - a.minutes);

  const anyMinutesMissing = missingAppeared.sort((a, b) => b.minutes - a.minutes);

  // First-team JSON names missing from current playable SL
  const firstTeamMissing: string[] = [];
  for (const [club, rows] of Object.entries(slSquads)) {
    for (const r of rows) {
      const hits = (currentByNorm.get(norm(r.name)) ?? []).filter(
        (h) => h.club === club && h.availableInGame !== false
      );
      if (hits.length === 0) firstTeamMissing.push(`${club}: ${r.name}`);
    }
  }

  // Current SL playable not in fantasy (unexpected / retired mid-season?)
  const fantasyNorm = new Set(fantasy.map((r) => norm(r.name)));
  const inDbNotFantasy: string[] = [];
  for (const p of current) {
    if (!SL.has(p.club) || p.availableInGame === false) continue;
    if (!fantasyNorm.has(norm(p.name))) {
      inDbNotFantasy.push(`${p.club}: ${p.name} (${p.id})`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    fantasyTotal: fantasy.length,
    fantasyAppeared: appeared.length,
    currentSlPlayable: current.filter(
      (p) => SL.has(p.club) && p.availableInGame !== false
    ).length,
    firstTeamJsonCount: [...firstTeamNorm].length,
    firstTeamMissingFromCurrent: firstTeamMissing,
    fantasyAppearedMissingFromSlCurrent: anyMinutesMissing.map((r) => ({
      name: r.name,
      pos: r.pos,
      minutes: r.minutes,
      score: r.score,
    })),
    fantasyHighMinutesMissing: highMinutesMissing.map((r) => ({
      name: r.name,
      pos: r.pos,
      minutes: r.minutes,
      score: r.score,
    })),
    currentSlNotInFantasy: inDbNotFantasy,
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  console.log("Fantasy total:", fantasy.length);
  console.log("Fantasy appeared (M>0):", appeared.length);
  console.log("Current SL playable:", report.currentSlPlayable);
  console.log("First-team missing from current:", firstTeamMissing.length);
  console.log(
    "Fantasy appeared missing from SL current:",
    anyMinutesMissing.length
  );
  console.log("High minutes (>=200) missing:");
  for (const r of highMinutesMissing.slice(0, 40)) {
    console.log(`  ${r.name.padEnd(30)} ${String(r.minutes).padStart(4)}m  ${r.pos}`);
  }
  console.log("Current SL not in fantasy:", inDbNotFantasy.length);
  for (const x of inDbNotFantasy.slice(0, 30)) console.log(" ", x);
  console.log("Wrote", OUT);
}

main();
