/**
 * Build teamYearRosters from verified player career spans, merged with
 * Wikipedia-verified Era squads (data/era-wikipedia-squads.json).
 *
 * Run: npx tsx scripts/generate-team-year-rosters.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import currentSquads from "../data/current-squads.json";
import eraWikipediaSquads from "../data/era-wikipedia-squads.json";
import slVerifiedSquads from "../data/sl-era-verified-squads.json";
import clubCareerSpans from "../data/club-career-spans.json";
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import { getPlayableClubNames } from "../src/lib/clubs/super-league-display";
import { normalizePlayer } from "../src/lib/players/normalize";
import {
  isPlayableTeamYearRoster,
  MIN_TEAM_YEAR_ROSTER_PLAYERS,
  getTeamYearRecruitPosition,
} from "../src/lib/players/team-year-roster-playable";
import { getRecruitListPositionsForSlot } from "../src/lib/game/position-placement";
import { SQUAD_STRUCTURE } from "../src/lib/positions";
import type { Player } from "../src/lib/types";

export type TeamYearRosters = Record<string, Record<string, string[]>>;

/** Super League competition started in 1996 — ignore earlier years for span pools. */
const SUPER_LEAGUE_MIN_YEAR = 1996;

/** Map RLP / short club labels to playable Super League club names. */
const RLP_CLUB_ALIASES: Record<string, string> = {
  "Hull KR": "Hull KR",
  "Hull Kingston Rovers": "Hull KR",
  Leigh: "Leigh Leopards",
  "Leigh Centurions": "Leigh Leopards",
  Salford: "Salford Red Devils",
  "Salford City Reds": "Salford Red Devils",
  York: "York Knights",
  "York City Knights": "York Knights",
  Huddersfield: "Huddersfield Giants",
  Wakefield: "Wakefield Trinity",
  "Wakefield Trinity Wildcats": "Wakefield Trinity",
  Wigan: "Wigan Warriors",
  Warrington: "Warrington Wolves",
  Leeds: "Leeds Rhinos",
  Bradford: "Bradford Bulls",
  Castleford: "Castleford Tigers",
  Catalans: "Catalans Dragons",
  London: "London Broncos",
  Widnes: "Widnes Vikings",
  Toulouse: "Toulouse Olympique",
  "St Helens": "St Helens",
  "Hull FC": "Hull FC",
  Oldham: "Oldham",
};

const EXTRA_CLUB_SPANS = clubCareerSpans as Record<string, string[]>;

type EraWikipediaSquads = Record<
  string,
  Record<string, { playerIds: string[]; source?: string }>
>;

function parseYearRange(yearsActive: string): { start: number; end: number } | null {
  const normalized = yearsActive.replace(/–/g, "-");
  const parts = normalized.split("-").map((part) => part.trim());
  if (parts.length < 1 || !parts[0]) return null;

  const startMatch = parts[0].match(/(\d{4})/);
  if (!startMatch) return null;
  const start = Number.parseInt(startMatch[1], 10);

  let end = start;
  if (parts.length > 1) {
    if (/present|unknown/i.test(parts[1])) {
      end = new Date().getFullYear();
    } else {
      const endMatch = parts[1].match(/(\d{4})/);
      if (endMatch) end = Number.parseInt(endMatch[1], 10);
    }
  }

  if (end < start) return null;
  return { start, end };
}

function getRawPlayers(): Record<string, unknown>[] {
  return [
    ...(currentSquads as Record<string, unknown>[]),
    ...(historicPlayers as Record<string, unknown>[]),
    ...(legends as Record<string, unknown>[]),
  ];
}

function buildPlayerIndex(): Map<string, Player> {
  const byId = new Map<string, Player>();
  for (const raw of getRawPlayers()) {
    const player = normalizePlayer(raw);
    if (player.availableInGame === false) continue;
    byId.set(player.id, player);
  }
  return byId;
}

function mergeVerifiedSquads(rosters: TeamYearRosters): number {
  let merged = 0;
  const sources = [
    eraWikipediaSquads as EraWikipediaSquads,
    slVerifiedSquads as EraWikipediaSquads,
  ];

  for (const wiki of sources) {
    for (const [team, years] of Object.entries(wiki)) {
      if (!rosters[team]) rosters[team] = {};
      for (const [year, entry] of Object.entries(years)) {
        if (!entry?.playerIds || entry.playerIds.length !== 13) continue;
        // Exact verified XIII — replaces generic yearsActive pool for this team-year.
        rosters[team][year] = [...entry.playerIds].sort((a, b) =>
          a.localeCompare(b)
        );
        merged++;
      }
    }
  }

  return merged;
}

function resolvePlayableClubs(
  raw: Record<string, unknown>,
  primaryClub: string,
  playable: Set<string>
): string[] {
  const clubs = new Set<string>();
  if (playable.has(primaryClub)) clubs.add(primaryClub);

  const playedFor = raw.clubsPlayedFor as string[] | undefined;
  if (playedFor) {
    for (const label of playedFor) {
      const mapped =
        RLP_CLUB_ALIASES[label] ??
        (playable.has(label) ? label : undefined);
      if (mapped) clubs.add(mapped);
    }
  }

  const id = raw.id as string;
  for (const team of EXTRA_CLUB_SPANS[id] ?? []) {
    if (playable.has(team)) clubs.add(team);
  }

  return [...clubs];
}

function addPlayerToClubYears(
  rosters: TeamYearRosters,
  club: string,
  playerId: string,
  range: { start: number; end: number }
): void {
  if (!rosters[club]) rosters[club] = {};
  for (let year = range.start; year <= range.end; year++) {
    if (year < SUPER_LEAGUE_MIN_YEAR) continue;
    const key = String(year);
    if (!rosters[club][key]) rosters[club][key] = [];
    if (!rosters[club][key].includes(playerId)) {
      rosters[club][key].push(playerId);
    }
  }
}

function buildRosters(
  playerById: Map<string, Player>,
  rawPlayers: Record<string, unknown>[]
): TeamYearRosters {
  const playable = new Set(getPlayableClubNames());
  const rosters: TeamYearRosters = {};

  for (const raw of rawPlayers) {
    const player = playerById.get(raw.id as string);
    if (!player) continue;

    const range = parseYearRange(player.yearsActive);
    if (!range) continue;

    for (const club of resolvePlayableClubs(raw, player.club, playable)) {
      addPlayerToClubYears(rosters, club, player.id, range);
    }
  }

  const wikiMerged = mergeVerifiedSquads(rosters);

  for (const team of Object.keys(rosters)) {
    for (const year of Object.keys(rosters[team])) {
      rosters[team][year].sort((a, b) => a.localeCompare(b));
    }
  }

  console.log(`Merged ${wikiMerged} Wikipedia-verified team-year squads`);
  return rosters;
}

function auditRosters(
  rosters: TeamYearRosters,
  playerById: Map<string, Player>
) {
  const resolve = (id: string) => playerById.get(id);
  const playable: Array<{ team: string; year: string; count: number }> = [];
  const incomplete: Array<{
    team: string;
    year: string;
    count: number;
    reason: string;
  }> = [];

  for (const team of Object.keys(rosters).sort()) {
    for (const year of Object.keys(rosters[team]).sort(
      (a, b) => Number(a) - Number(b)
    )) {
      const ids = rosters[team][year]!;
      if (isPlayableTeamYearRoster(team, year, ids, resolve)) {
        playable.push({ team, year, count: ids.length });
        continue;
      }

      let reason = "unknown";
      if (ids.length < MIN_TEAM_YEAR_ROSTER_PLAYERS) {
        reason = `fewer than ${MIN_TEAM_YEAR_ROSTER_PLAYERS} players`;
      } else {
        const players = ids
          .map((id) => resolve(id))
          .filter((p): p is Player => !!p);
        for (const { position, count } of SQUAD_STRUCTURE) {
          const allowed = new Set(getRecruitListPositionsForSlot(position));
          const matching = players.filter((p) =>
            allowed.has(getTeamYearRecruitPosition(team, year, p))
          ).length;
          if (matching < count) {
            reason = `missing ${position} coverage (${matching}/${count})`;
            break;
          }
        }
      }

      incomplete.push({ team, year, count: ids.length, reason });
    }
  }

  return { playable, incomplete };
}

const rawPlayers = getRawPlayers();
const playerById = buildPlayerIndex();
const rosters = buildRosters(playerById, rawPlayers);
const { playable, incomplete } = auditRosters(rosters, playerById);

const dataDir = join(process.cwd(), "data");
writeFileSync(
  join(dataDir, "team-year-rosters.json"),
  `${JSON.stringify(rosters, null, 2)}\n`
);

writeFileSync(
  join(dataDir, "team-year-rosters-audit.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sources: [
        "Player yearsActive spans (Super League 1996+, current-squads, historic-players, legends)",
        "Secondary clubs via clubsPlayedFor + club-career-spans.json",
        "Wikipedia-verified Era squads (era-wikipedia-squads.json)",
        "Manual SL verified squads (sl-era-verified-squads.json)",
      ],
      minPlayers: MIN_TEAM_YEAR_ROSTER_PLAYERS,
      playableCount: playable.length,
      incompleteCount: incomplete.length,
      playable,
      incomplete,
    },
    null,
    2
  )}\n`
);

console.log(`Wrote data/team-year-rosters.json`);
console.log(
  `Playable team-years: ${playable.length} | Incomplete/hidden: ${incomplete.length}`
);
