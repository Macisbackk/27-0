/**
 * Apply authoritative 2026 Super League squads to current-squads.json
 * and generate exact 2026 team-year pools.
 *
 * Run: npm run apply:2026-squads
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import sl2026Squads from "../data/sl-2026-squads.json";
import { PLAYER_RATING_OVERRIDES } from "../data/player-rating-overrides";
import { buildTeamYearId } from "../src/lib/game/team-year-pools";
import { parsePositionAbbreviations } from "../src/lib/players/player-positions";
import { computePlayerValue } from "../src/lib/players/ratings";
import type { Position } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const CURRENT_PATH = join(ROOT, "data", "current-squads.json");
const TEAM_YEAR_PATH = join(ROOT, "data", "current-team-year-squads-2026.json");
const REPORT_PATH = join(ROOT, "data", "sl-2026-squads-apply-report.json");

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

const SL_2026_CLUBS = Object.keys(CLUB_SLUGS);

const DISPLAY_NAME_FIXES: Record<string, string> = {
  "Nick Cotric": "Nick Čotrić",
  "Jarrod O Connor": "Jarrod O'Connor",
  "Gareth O Brien": "Gareth O'Brien",
  "Ethan O Neill": "Ethan O'Neill",
  "Kai O Donnell": "Kai O'Donnell",
  "Brad O Neill": "Brad O'Neill",
  "Herman Eseese": "Herman Ese'ese",
  "Paul Seguier": "Paul Séguier",
  "Cesar Rouge": "César Rougé",
  "Justin Sangare": "Justin Sangaré",
  "Xavier Vaa": "Xavier Va'a",
  "Toa Mataafa": "Toa Mata'afa",
};

type SquadRow = { name: string; positions: string; rating: number };
type RawPlayer = Record<string, unknown> & {
  id: string;
  name: string;
  club: string;
  position: string;
  category: string;
  peakRating: number;
  rating: number;
  value: number;
  yearsActive: string;
  nationality: string;
};

type TeamYearSquadFile = Record<
  string,
  Record<
    string,
    {
      playerIds: string[];
      positions: string[];
      source: string;
      isCurrentSeason: boolean;
      isSuperLeagueSeason: boolean;
      playableInNormalSpin: boolean;
      playableInEra: boolean;
      playableInEraChallengeCup: boolean;
    }
  >
>;

function normalizeNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugifyName(name: string): string {
  return normalizeNameKey(name).replace(/\s+/g, "-");
}

function buildPlayerId(club: string, name: string): string {
  return `${CLUB_SLUGS[club]}-cur-${slugifyName(name)}`;
}

function primaryPosition(abbrev: string): Position {
  return parsePositionAbbreviations(abbrev.split("/")[0]!)[0]!;
}

function findExisting(
  players: RawPlayer[],
  club: string,
  name: string
): RawPlayer | undefined {
  const key = normalizeNameKey(name);
  const display = DISPLAY_NAME_FIXES[name] ?? name;
  const displayKey = normalizeNameKey(display);

  return players.find((p) => {
    if (p.club !== club) return false;
    const pKey = normalizeNameKey(p.name);
    return pKey === key || pKey === displayKey;
  });
}

function main(): void {
  const existing = JSON.parse(
    readFileSync(CURRENT_PATH, "utf8")
  ) as RawPlayer[];
  const squads = sl2026Squads as Record<string, SquadRow[]>;

  const kept = existing.filter(
    (p) => !SL_2026_CLUBS.includes(p.club) || p.availableInGame === false
  );
  const newPlayers: RawPlayer[] = [];
  const teamYearSquads: TeamYearSquadFile = {};
  const report = {
    generatedAt: new Date().toISOString(),
    added: [] as string[],
    updated: [] as string[],
    removed: [] as string[],
    ratingsChanged: [] as { id: string; name: string; from: number; to: number }[],
    missingNationality: [] as string[],
    teams: {} as Record<string, { playerIds: string[]; count: number }>,
  };

  const newIds = new Set<string>();

  for (const club of SL_2026_CLUBS) {
    const rows = squads[club];
    if (!rows || rows.length !== 17) {
      throw new Error(`${club} must have exactly 17 players (has ${rows?.length ?? 0})`);
    }

    const teamYearId = buildTeamYearId(club, String(CURRENT_YEAR));
    const playerIds: string[] = [];
    const slotPositions: string[] = [];

    for (const row of rows) {
      const displayName = DISPLAY_NAME_FIXES[row.name] ?? row.name;
      const id = buildPlayerId(club, row.name);
      const positions = parsePositionAbbreviations(row.positions);
      const position = primaryPosition(row.positions);
      const prev = findExisting(existing, club, displayName);

      let rating = row.rating;
      if (PLAYER_RATING_OVERRIDES[id] !== undefined) {
        rating = PLAYER_RATING_OVERRIDES[id];
      }

      const value = computePlayerValue(rating, position, "current");

      const player: RawPlayer = {
        ...(prev ?? {}),
        id,
        name: displayName,
        club,
        currentClub: club,
        teamYearId,
        year: CURRENT_YEAR,
        status: "Current",
        position,
        positions: positions.map((p) => p),
        positionAbbrev: row.positions,
        nationality: (prev?.nationality as string) ?? "unknown",
        era: "CONTEMPORARY_ERA",
        yearsActive: prev?.yearsActive ?? "2020–Present",
        category: "current",
        peakRating: rating,
        rating,
        value,
        appearances: prev?.appearances,
        tries: prev?.tries,
        dateOfBirth: prev?.dateOfBirth,
        birthYear: prev?.birthYear,
        intlCaps: prev?.intlCaps,
        superLeagueWinner: prev?.superLeagueWinner,
        challengeCupWinner: prev?.challengeCupWinner,
      };

      if (!prev?.nationality || prev.nationality === "unknown") {
        report.missingNationality.push(`${displayName} (${club})`);
      }

      if (prev) {
        const oldRating = (prev.peakRating ?? prev.rating) as number;
        if (oldRating !== rating) {
          report.ratingsChanged.push({
            id,
            name: displayName,
            from: oldRating,
            to: rating,
          });
        }
        report.updated.push(id);
      } else {
        report.added.push(id);
      }

      newPlayers.push(player);
      newIds.add(id);
      playerIds.push(id);
      slotPositions.push(position);
    }

    teamYearSquads[club] = {
      [String(CURRENT_YEAR)]: {
        playerIds,
        positions: slotPositions,
        source: "sl-2026-squads.json",
        isCurrentSeason: true,
        isSuperLeagueSeason: true,
        playableInNormalSpin: true,
        playableInEra: true,
        playableInEraChallengeCup: true,
      },
    };

    report.teams[club] = { playerIds, count: playerIds.length };
  }

  for (const p of existing) {
    if (SL_2026_CLUBS.includes(p.club) && !newIds.has(p.id)) {
      report.removed.push(`${p.id} (${p.name} @ ${p.club})`);
    }
  }

  const merged = [...kept, ...newPlayers].sort((a, b) =>
    a.club.localeCompare(b.club) || a.name.localeCompare(b.name)
  );

  writeFileSync(CURRENT_PATH, `${JSON.stringify(merged, null, 2)}\n`);
  writeFileSync(TEAM_YEAR_PATH, `${JSON.stringify(teamYearSquads, null, 2)}\n`);
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Wrote ${CURRENT_PATH} (${merged.length} players)`);
  console.log(`Wrote ${TEAM_YEAR_PATH}`);
  console.log(`Added: ${report.added.length} | Updated: ${report.updated.length} | Removed: ${report.removed.length}`);
  console.log(`Ratings changed: ${report.ratingsChanged.length}`);
}

main();
