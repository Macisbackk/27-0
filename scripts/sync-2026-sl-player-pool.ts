/**
 * Sync 2026 Super League depth players into current-squads.json.
 *
 * - Hides non-SL Championship leftovers from the playable Current pool
 * - Fixes known first-team errors (Leigh McIntosh → Josh Charnley)
 * - Adds verified missing 2026 SL players (significant minutes / registered squad)
 *
 * Does NOT rewrite team-year spin pools (still driven by sl-2026-squads.json
 * via apply:2026-squads). Depth players are Showcase / mini-game / recruitment.
 *
 * Run: npx tsx scripts/sync-2026-sl-player-pool.ts
 * Then: npm run build:player-chunks
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { buildTeamYearId } from "../src/lib/game/team-year-pools";
import { computePlayerValue } from "../src/lib/players/ratings";
import { clampCurrentSuperLeagueRating } from "../src/lib/players/rating-floors";
import type { Position } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const CURRENT_PATH = join(ROOT, "data", "current-squads.json");
const HISTORIC_PATH = join(ROOT, "data", "historic-players.json");
const BIRTH_YEARS_PATH = join(ROOT, "data", "birth-years.json");
const SL_SQUADS_PATH = join(ROOT, "data", "sl-2026-squads.json");
const REPORT_PATH = join(ROOT, "data", "sync-2026-sl-player-pool-report.json");

const CURRENT_YEAR = 2026;

const CLUB_SLUGS: Record<string, string> = {
  "Bradford Bulls": "bradford",
  "Castleford Tigers": "castleford",
  "Catalans Dragons": "catalans",
  "Huddersfield Giants": "huddersfield",
  "Hull FC": "hull-fc",
  "Hull KR": "hull-kr",
  "Leeds Rhinos": "leeds",
  "Leigh Leopards": "leigh",
  "St Helens": "st-helens",
  "Toulouse Olympique": "toulouse",
  "Wakefield Trinity": "wakefield",
  "Warrington Wolves": "warrington",
  "Wigan Warriors": "wigan",
  "York Knights": "york",
};

const SL_CLUBS = new Set(Object.keys(CLUB_SLUGS));

type Raw = Record<string, unknown> & {
  id: string;
  name: string;
  club: string;
  position: string;
  nationality: string;
  peakRating: number;
  value?: number;
  category?: string;
  availableInGame?: boolean;
  superLeagueEligible?: boolean;
  dateOfBirth?: string;
  birthYear?: number;
  yearsActive?: string;
  appearances?: number;
  tries?: number;
};

type DepthRow = {
  name: string;
  club: string;
  position: Position;
  nationality: string;
  dateOfBirth?: string;
  birthYear?: number;
  rating: number;
  /** Source note for the report */
  source: string;
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[''`’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NAME_ALIASES: Record<string, string> = {
  "lachlan miller": "lachie miller",
  "oliver ashall bott": "olly ashall bott",
  "caleb uele": "caleb hamlin uele",
  "paul seguier": "paul seguier",
  "tuimoala lolohea": "tui lolohea",
  "jonathan bennison": "jon bennison",
};

function aliasKey(name: string): string {
  const k = norm(name);
  return NAME_ALIASES[k] ?? k;
}

function slugify(name: string): string {
  return norm(name).replace(/\s+/g, "-");
}

function buildId(club: string, name: string): string {
  return `${CLUB_SLUGS[club]}-cur-${slugify(name)}`;
}

/**
 * Verified 2026 Super League players missing from Current DB (or wrongly clubbed).
 * Facts checked against official club pages / Super League / Wikipedia / RLP where cited.
 * Ratings: historic peak where available, else Fantasy-informed 80+ floor.
 */
const DEPTH_ADDITIONS: DepthRow[] = [
  {
    name: "Josh Charnley",
    club: "Leigh Leopards",
    position: "WING",
    nationality: "England",
    dateOfBirth: "1991-06-26",
    birthYear: 1991,
    rating: 84,
    source: "Leigh #5 SARL/Wikipedia; replaces erroneous McIntosh Leigh first-team slot",
  },
  {
    name: "Innes Senior",
    club: "Leigh Leopards",
    position: "WING",
    nationality: "Ireland",
    dateOfBirth: "2000-05-30",
    birthYear: 2000,
    rating: 84,
    source: "Leigh official #19; Ireland international (Wikipedia/Leigh)",
  },
  {
    name: "Jack Broadbent",
    club: "Hull KR",
    position: "CENTRE",
    nationality: "England",
    dateOfBirth: "2000-11-01",
    birthYear: 2000,
    rating: 84,
    source: "Hull KR #14; Fantasy 345m; DOB RLP/NRL.com",
  },
  {
    name: "Logan Moy",
    club: "Hull FC",
    position: "FULLBACK",
    nationality: "England",
    rating: 83,
    source: "Hull FC #24; Fantasy 278m; England (historic card) — DOB not yet verified",
  },
  {
    name: "Ryan Hall",
    club: "Leeds Rhinos",
    position: "WING",
    nationality: "England",
    dateOfBirth: "1987-11-27",
    birthYear: 1987,
    rating: 84,
    source: "Leeds #5; Fantasy 228m; England international",
  },
  {
    name: "Chris Hankinson",
    club: "Leeds Rhinos",
    position: "CENTRE",
    nationality: "England",
    rating: 83,
    source: "Leeds #14; Fantasy 203m; England (historic card) — DOB not yet verified",
  },
  {
    name: "Phoenix Laulu-Togaga'e",
    club: "Castleford Tigers",
    position: "FULLBACK",
    nationality: "England",
    rating: 82,
    source: "Castleford mid-season signing from Catalans (Apr 2026, Super League/BBC) — DOB not yet verified",
  },
  {
    name: "Tyler Dupree",
    club: "Castleford Tigers",
    position: "PROP",
    nationality: "England",
    dateOfBirth: "2000-02-08",
    birthYear: 2000,
    rating: 84,
    source: "Castleford permanent from Toulouse loan (Apr 2026, BBC/LRL/Wikipedia)",
  },
  {
    name: "Josh Smith",
    club: "Warrington Wolves",
    position: "CENTRE",
    nationality: "England",
    rating: 81,
    source: "Warrington #26; Fantasy 207m centre — DOB not yet verified",
  },
  {
    name: "Louis Senior",
    club: "Castleford Tigers",
    position: "WING",
    nationality: "Ireland",
    dateOfBirth: "2000-05-30",
    birthYear: 2000,
    rating: 82,
    source: "Castleford #21; twin of Innes; Ireland international",
  },
  {
    name: "Kruise Leeming",
    club: "Catalans Dragons",
    position: "HOOKER",
    nationality: "England",
    rating: 85,
    source: "Catalans #19 2026 (loan from Wigan); England (historic) — DOB not yet verified",
  },
  {
    name: "Joe Keyes",
    club: "Bradford Bulls",
    position: "SCRUM_HALF",
    nationality: "Ireland",
    rating: 81,
    source: "Bradford #18; Ireland international half — DOB not yet verified",
  },
  {
    name: "Sam Hallas",
    club: "Bradford Bulls",
    position: "HOOKER",
    nationality: "England",
    rating: 80,
    source: "Bradford #21 registered squad — DOB not yet verified",
  },
  {
    name: "Danny Levi",
    club: "Leeds Rhinos",
    position: "HOOKER",
    nationality: "New Zealand",
    rating: 82,
    source: "Leeds #23; NZ international hooker (historic) — DOB not yet verified",
  },
  {
    name: "AJ Towse",
    club: "Leigh Leopards",
    position: "WING",
    nationality: "England",
    rating: 81,
    source: "Leigh #20 registered squad — DOB not yet verified",
  },
  {
    name: "Romain Navarrete",
    club: "Catalans Dragons",
    position: "PROP",
    nationality: "France",
    rating: 82,
    source: "Catalans 2026 rotation; Fantasy 122m; historic catalans-hist-romain-navarrete",
  },
  {
    name: "Kian McDermott",
    club: "Wigan Warriors",
    position: "PROP",
    nationality: "England",
    rating: 78,
    source: "Wigan 2026 squad depth; Fantasy 49m — DOB not yet verified",
  },
  {
    name: "Jenson Windley",
    club: "Castleford Tigers",
    position: "SCRUM_HALF",
    nationality: "England",
    rating: 79,
    source: "Castleford 2026 squad depth; Fantasy 34m — DOB not yet verified",
  },
  {
    name: "Dayon Sambou",
    club: "Wigan Warriors",
    position: "CENTRE",
    nationality: "England",
    rating: 78,
    source: "Wigan 2026 (from London path); Fantasy 15m — DOB not yet verified",
  },
];

function findByName(players: Raw[], name: string): Raw | undefined {
  const key = aliasKey(name);
  return players.find((p) => aliasKey(p.name) === key);
}

function findHistoricBio(historic: Raw[], name: string): Raw | undefined {
  const key = aliasKey(name);
  const hits = historic.filter((p) => aliasKey(p.name) === key);
  // Prefer non-era-generated cards with DOB/nationality
  return (
    hits.find((p) => p.dateOfBirth && p.nationality && p.nationality !== "Unknown") ??
    hits.find((p) => p.nationality && p.nationality !== "Unknown") ??
    hits[0]
  );
}

function hideChampionshipLeftovers(players: Raw[]): string[] {
  const hidden: string[] = [];
  for (const p of players) {
    if (p.category !== "current" && p.status !== "Current") continue;
    if (SL_CLUBS.has(p.club)) continue;
    if (p.availableInGame === false && p.superLeagueEligible === false) continue;
    p.availableInGame = false;
    p.superLeagueEligible = false;
    hidden.push(p.id);
  }
  return hidden;
}

function ensurePlayer(
  players: Raw[],
  historic: Raw[],
  birthYears: Record<string, number>,
  row: DepthRow
): { action: "added" | "updated" | "skipped"; id: string } {
  const id = buildId(row.club, row.name);
  const existingSameClub = players.find(
    (p) => p.id === id || (aliasKey(p.name) === aliasKey(row.name) && p.club === row.club)
  );
  const existingAny = findByName(players, row.name);
  const hist = findHistoricBio(historic, row.name);

  const rating = clampCurrentSuperLeagueRating(row.rating);
  const value = computePlayerValue(rating, row.position, "current");
  const teamYearId = buildTeamYearId(row.club, String(CURRENT_YEAR));

  const nationality =
    row.nationality ||
    (hist?.nationality && hist.nationality !== "Unknown" ? hist.nationality : null) ||
    "Unknown";

  const dateOfBirth =
    row.dateOfBirth ||
    (typeof hist?.dateOfBirth === "string" ? hist.dateOfBirth : undefined);
  const birthYear =
    row.birthYear ||
    (typeof hist?.birthYear === "number" ? hist.birthYear : undefined) ||
    birthYears[norm(row.name)] ||
    (dateOfBirth ? Number(dateOfBirth.slice(0, 4)) : undefined);

  const base: Raw = {
    ...(existingSameClub ??
      (existingAny && !SL_CLUBS.has(existingAny.club) ? existingAny : {})),
    id,
    name: row.name,
    club: row.club,
    currentClub: row.club,
    team: row.club,
    displayClub: row.club,
    position: row.position,
    positions: [row.position],
    primaryPosition: row.position,
    nationality,
    era: "CONTEMPORARY_ERA",
    yearsActive: (existingSameClub?.yearsActive as string) ?? "2020–Present",
    category: "current",
    peakRating: rating,
    value,
    appearances: existingSameClub?.appearances ?? hist?.appearances ?? 0,
    tries: existingSameClub?.tries ?? hist?.tries ?? 0,
    teamYearId,
    year: CURRENT_YEAR,
    cardYear: CURRENT_YEAR,
    status: "Current",
    basePlayerId: id,
    availableInGame: true,
    superLeagueEligible: true,
  };

  if (dateOfBirth) base.dateOfBirth = dateOfBirth;
  if (birthYear) base.birthYear = birthYear;

  if (existingSameClub) {
    Object.assign(existingSameClub, base);
    return { action: "updated", id };
  }

  // If they exist at wrong SL club, move rather than duplicate
  if (existingAny && SL_CLUBS.has(existingAny.club) && existingAny.club !== row.club) {
    // Remove old id entry and add at new club
    const idx = players.indexOf(existingAny);
    if (idx >= 0) players.splice(idx, 1);
    players.push(base);
    return { action: "updated", id };
  }

  if (existingAny && !SL_CLUBS.has(existingAny.club)) {
    const idx = players.indexOf(existingAny);
    if (idx >= 0) players.splice(idx, 1);
  }

  players.push(base);
  return { action: "added", id };
}

function fixLeighFirstTeamJson(): void {
  const squads = JSON.parse(readFileSync(SL_SQUADS_PATH, "utf8")) as Record<
    string,
    { name: string; positions: string; rating: number }[]
  >;
  const leigh = squads["Leigh Leopards"];
  if (!leigh) return;
  const idx = leigh.findIndex((r) => norm(r.name) === "darnell mcintosh");
  if (idx >= 0) {
    leigh[idx] = { name: "Josh Charnley", positions: "WG", rating: 84 };
    writeFileSync(SL_SQUADS_PATH, JSON.stringify(squads, null, 2) + "\n", "utf8");
  }
}

function main() {
  fixLeighFirstTeamJson();

  const players = JSON.parse(readFileSync(CURRENT_PATH, "utf8")) as Raw[];
  const historic = JSON.parse(readFileSync(HISTORIC_PATH, "utf8")) as Raw[];
  const birthYears = JSON.parse(readFileSync(BIRTH_YEARS_PATH, "utf8")) as Record<
    string,
    number
  >;

  const before = players.filter(
    (p) => SL_CLUBS.has(p.club) && p.availableInGame !== false
  ).length;

  const hidden = hideChampionshipLeftovers(players);

  // Remove erroneous Leigh McIntosh current card if present (keep Castleford)
  const leighMcIntosh = players.find(
    (p) =>
      p.club === "Leigh Leopards" &&
      aliasKey(p.name) === "darnell mcintosh" &&
      p.availableInGame !== false
  );
  const removedIds: string[] = [];
  if (leighMcIntosh) {
    leighMcIntosh.availableInGame = false;
    leighMcIntosh.superLeagueEligible = false;
    removedIds.push(leighMcIntosh.id);
  }

  const added: string[] = [];
  const updated: string[] = [];
  const unresolved: Array<{ name: string; field: string; reason: string }> = [];

  for (const row of DEPTH_ADDITIONS) {
    const result = ensurePlayer(players, historic, birthYears, row);
    if (result.action === "added") added.push(result.id);
    if (result.action === "updated") updated.push(result.id);

    const p = players.find((x) => x.id === result.id);
    if (p && (!p.nationality || p.nationality === "Unknown")) {
      unresolved.push({
        name: row.name,
        field: "nationality",
        reason: "Could not verify nationality confidently",
      });
    }
    if (p && !p.dateOfBirth && !p.birthYear) {
      unresolved.push({
        name: row.name,
        field: "dateOfBirth/birthYear",
        reason: "No verified DOB/birth year located yet",
      });
    }
  }

  // Stable sort by club then name for diffs
  players.sort((a, b) => {
    const c = a.club.localeCompare(b.club);
    return c !== 0 ? c : a.name.localeCompare(b.name);
  });

  writeFileSync(CURRENT_PATH, JSON.stringify(players, null, 2) + "\n", "utf8");

  const after = players.filter(
    (p) => SL_CLUBS.has(p.club) && p.availableInGame !== false
  ).length;

  const report = {
    generatedAt: new Date().toISOString(),
    currentSlPlayableBefore: before,
    currentSlPlayableAfter: after,
    championshipHidden: hidden,
    removedErroneous: removedIds,
    added,
    updated,
    unresolved,
    note: "Team-year spin pools unchanged except Leigh first-team JSON fix (McIntosh→Charnley). Re-run apply:2026-squads then build:player-chunks.",
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main();
