/**
 * Close open honour gaps:
 * - Add Jack Farrimond to Wigan Current (Lance Todd + CC + LLS 2026)
 * - Remap Dream Team orphans (Robbie McCormack 1998, Danny Richardson 2018)
 * - Backfill League Leaders years from quiz facts + era squads / year cards
 *
 * Run: npx tsx scripts/backfill-open-honours.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { computePlayerValue } from "../src/lib/players/ratings";
import type { Position } from "../src/lib/types";
import { trophyWinnerNameKey } from "./lib/sources/wikipedia-trophies";

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");

type Raw = Record<string, unknown> & {
  id: string;
  name: string;
  club?: string;
  team?: string;
  displayClub?: string;
  year?: number;
  cardYear?: number;
  teamYearId?: string;
  category?: string;
  position?: string;
  peakRating?: number;
  value?: number;
  basePlayerId?: string;
};

const LLS_SEASONS: { year: number; club: string }[] = [
  { year: 2006, club: "St Helens" },
  { year: 2007, club: "St Helens" },
  { year: 2008, club: "St Helens" },
  { year: 2014, club: "St Helens" },
  { year: 2017, club: "Castleford Tigers" },
  { year: 2019, club: "St Helens" },
  { year: 2021, club: "Catalans Dragons" },
  { year: 2022, club: "St Helens" },
  { year: 2023, club: "Wigan Warriors" },
  { year: 2024, club: "Wigan Warriors" },
  { year: 2025, club: "Hull KR" },
  { year: 2026, club: "Wigan Warriors" },
];

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(DATA, name), "utf8")) as T;
}

function saveJson(name: string, data: unknown): void {
  writeFileSync(join(DATA, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function slugifyClub(club: string): string {
  return club
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clubOf(p: Raw): string {
  return String(p.displayClub ?? p.team ?? p.club ?? "");
}

function mergeYears(
  map: Record<string, number[]>,
  id: string,
  years: number[]
): void {
  map[id] = [...new Set([...(map[id] ?? []), ...years])].sort((a, b) => a - b);
}

function pickBestId(
  name: string,
  year: number,
  club: string,
  players: Raw[]
): string | null {
  const key = trophyWinnerNameKey(name);
  const candidates = players.filter(
    (p) => trophyWinnerNameKey(p.name) === key
  );
  if (candidates.length === 0) return null;

  const clubSlug = slugifyClub(club);
  const teamYearId = `${clubSlug}-${year}`;
  const scored = candidates.map((p) => {
    let score = 0;
    if (p.teamYearId === teamYearId) score += 100;
    if (p.id.endsWith(`-${year}`)) score += 80;
    if (clubOf(p) === club && (p.year === year || p.cardYear === year)) score += 60;
    if (clubOf(p) === club) score += 20;
    if (p.category === "historic" || p.category === "legend") score += 5;
    return { id: p.id, score };
  });
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return scored[0]?.id ?? null;
}

function main(): void {
  const current = loadJson<Raw[]>("current-squads.json");
  const historic = loadJson<Raw[]>("historic-players.json");
  const legends = loadJson<Raw[]>("legends.json");
  const allPlayers = [...current, ...historic, ...legends];
  const byId = new Map(allPlayers.map((p) => [p.id, p]));

  // --- 1. Jack Farrimond ---
  if (!byId.has("wigan-cur-jack-farrimond")) {
    const peakRating = 82;
    const position = "STAND_OFF" as Position;
    const farrimond: Raw = {
      id: "wigan-cur-jack-farrimond",
      name: "Jack Farrimond",
      position,
      positions: ["STAND_OFF", "SCRUM_HALF"],
      positionAbbrev: "SO",
      primaryPosition: "SO",
      club: "Wigan Warriors",
      currentClub: "Wigan Warriors",
      team: "Wigan Warriors",
      displayClub: "Wigan Warriors",
      nationality: "England",
      era: "CONTEMPORARY_ERA",
      yearsActive: "2026–Present",
      category: "current",
      peakRating,
      rating: peakRating,
      value: computePlayerValue(peakRating, position, "current"),
      birthYear: 2005,
      teamYearId: "wigan-warriors-2026",
      year: 2026,
      cardYear: 2026,
      status: "Current",
      basePlayerId: "wigan-cur-jack-farrimond",
      challengeCupWinner: true,
      availableInGame: true,
      superLeagueEligible: true,
    };
    current.push(farrimond);
    byId.set(farrimond.id, farrimond);
    allPlayers.push(farrimond);
    console.log("Added wigan-cur-jack-farrimond to Current");
  } else {
    const existing = byId.get("wigan-cur-jack-farrimond")!;
    existing.challengeCupWinner = true;
    console.log("Farrimond already in Current — ensured CC flag");
  }

  // --- 2. Dream Team orphan remaps + Richardson 2018 year card ---
  const dream = loadJson<Record<string, number[]>>("dream-team-years.json");

  if (!byId.has("st-helens-hist-danny-richardson-2018")) {
    const richardson: Raw = {
      id: "st-helens-hist-danny-richardson-2018",
      name: "Danny Richardson",
      position: "SCRUM_HALF",
      club: "St Helens",
      team: "St Helens",
      displayClub: "St Helens",
      nationality: "England",
      era: "CONTEMPORARY_ERA",
      yearsActive: "2018–2018",
      category: "historic",
      peakRating: 82,
      value: computePlayerValue(82, "SCRUM_HALF", "historic"),
      birthYear: 1996,
      year: 2018,
      cardYear: 2018,
      teamYearId: "st-helens-2018",
      status: "Historic",
      basePlayerId: "hull-kr-cur-danny-richardson",
      primaryPosition: "SH",
      availableInGame: true,
      superLeagueEligible: true,
    };
    historic.push(richardson);
    byId.set(richardson.id, richardson);
    allPlayers.push(richardson);
    console.log("Created st-helens-hist-danny-richardson-2018");
  }

  const dreamMoves: Record<string, string> = {
    "leeds-cur-ned-mccormack": "wigan-hist-era-robbie-mccormack",
    "york-cur-danny-richardson": "st-helens-hist-danny-richardson-2018",
  };
  for (const [src, dst] of Object.entries(dreamMoves)) {
    if (!(src in dream)) {
      console.log(`dream skip missing ${src}`);
      continue;
    }
    const years = dream[src]!;
    delete dream[src];
    mergeYears(dream, dst, years);
    console.log(`dream ${src} -> ${dst}: ${dream[dst]!.join(",")}`);
  }

  // --- 3. League Leaders backfill ---
  const ll = loadJson<Record<string, number[]>>("league-leaders-years.json");
  const eraSquads = loadJson<
    Array<{ club: string; year: number; squad: Array<{ name: string }> }>
  >("era-starting-17s.json");
  const teamYearRosters = loadJson<Record<string, Record<string, string[]>>>(
    "team-year-rosters.json"
  );

  const unmatched: string[] = [];

  for (const { year, club } of LLS_SEASONS) {
    const ids = new Set<string>();

    // Strict year-pinned cards at that club
    const teamYearId = `${slugifyClub(club)}-${year}`;
    for (const p of allPlayers) {
      if (clubOf(p) !== club) continue;
      if (p.teamYearId === teamYearId || p.id.endsWith(`-${year}`)) {
        ids.add(p.id);
      }
    }

    // team-year-rosters
    const roster = teamYearRosters[club]?.[String(year)] ?? [];
    for (const id of roster) {
      if (byId.has(id)) ids.add(id);
    }

    // era starting 17 name match
    const era = eraSquads.find((e) => e.club === club && e.year === year);
    if (era) {
      for (const row of era.squad) {
        const id = pickBestId(row.name, year, club, allPlayers);
        if (id) ids.add(id);
        else unmatched.push(`${row.name} (${club} ${year})`);
      }
    }

    // Current squad still at LLS club for recent seasons
    if (year >= 2023) {
      for (const p of current) {
        if (clubOf(p) !== club) continue;
        if (year === 2026) {
          ids.add(p.id);
          continue;
        }
        // Prior LLS: only if they already have SL (likely present) or existing LLS year
        if (p.superLeagueWinner === true || (ll[p.id] ?? []).includes(year)) {
          ids.add(p.id);
        }
      }
    }

    for (const id of ids) mergeYears(ll, id, [year]);
    console.log(`LLS ${year} ${club}: ${ids.size} players`);
  }

  // Ensure Farrimond has 2026 LLS
  mergeYears(ll, "wigan-cur-jack-farrimond", [2026]);

  saveJson("current-squads.json", current);
  saveJson("historic-players.json", historic);
  saveJson("dream-team-years.json", dream);
  saveJson(
    "league-leaders-years.json",
    Object.fromEntries(Object.entries(ll).sort(([a], [b]) => a.localeCompare(b)))
  );

  // Sync current-team-year-squads if present
  try {
    const squads2026 = loadJson<{
      clubs?: Record<string, { playerIds?: string[] }>;
    }>("current-team-year-squads-2026.json");
    const wigan = squads2026.clubs?.["Wigan Warriors"];
    if (wigan?.playerIds && !wigan.playerIds.includes("wigan-cur-jack-farrimond")) {
      wigan.playerIds.push("wigan-cur-jack-farrimond");
      saveJson("current-team-year-squads-2026.json", squads2026);
      console.log("Added Farrimond to current-team-year-squads-2026");
    }
  } catch {
    /* optional */
  }

  if (unmatched.length) {
    console.log(`\nUnmatched era names (${unmatched.length}):`);
    for (const row of unmatched.slice(0, 40)) console.log(`  ${row}`);
  }
  console.log("done");
}

main();
