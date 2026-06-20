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
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import { getPlayableClubNames } from "../src/lib/clubs/super-league-display";
import { normalizePlayer } from "../src/lib/players/normalize";
import {
  isPlayableTeamYearRoster,
  MIN_TEAM_YEAR_ROSTER_PLAYERS,
} from "../src/lib/players/team-year-roster-playable";
import { getRecruitListPositionsForSlot } from "../src/lib/game/position-placement";
import { SQUAD_STRUCTURE } from "../src/lib/positions";
import type { Player } from "../src/lib/types";

export type TeamYearRosters = Record<string, Record<string, string[]>>;

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
    if (/present/i.test(parts[1])) {
      end = new Date().getFullYear();
    } else {
      const endMatch = parts[1].match(/(\d{4})/);
      if (endMatch) end = Number.parseInt(endMatch[1], 10);
    }
  }

  if (end < start) return null;
  return { start, end };
}

function buildPlayerIndex(): Map<string, Player> {
  const rawPlayers = [
    ...(currentSquads as Record<string, unknown>[]),
    ...(historicPlayers as Record<string, unknown>[]),
    ...(legends as Record<string, unknown>[]),
  ];

  const byId = new Map<string, Player>();
  for (const raw of rawPlayers) {
    const player = normalizePlayer(raw);
    if (player.availableInGame === false) continue;
    byId.set(player.id, player);
  }
  return byId;
}

function mergeWikipediaSquads(rosters: TeamYearRosters): number {
  let merged = 0;
  const wiki = eraWikipediaSquads as EraWikipediaSquads;

  for (const [team, years] of Object.entries(wiki)) {
    if (!rosters[team]) rosters[team] = {};
    for (const [year, entry] of Object.entries(years)) {
      if (!entry?.playerIds || entry.playerIds.length !== 13) continue;
      const existing = new Set(rosters[team][year] ?? []);
      for (const id of entry.playerIds) {
        existing.add(id);
      }
      rosters[team][year] = [...existing].sort((a, b) => a.localeCompare(b));
      merged++;
    }
  }

  return merged;
}

function buildRosters(playerById: Map<string, Player>): TeamYearRosters {
  const playable = new Set(getPlayableClubNames());
  const rosters: TeamYearRosters = {};

  for (const player of playerById.values()) {
    if (!playable.has(player.club)) continue;

    const range = parseYearRange(player.yearsActive);
    if (!range) continue;

    if (!rosters[player.club]) rosters[player.club] = {};

    for (let year = range.start; year <= range.end; year++) {
      const key = String(year);
      if (!rosters[player.club][key]) rosters[player.club][key] = [];
      if (!rosters[player.club][key].includes(player.id)) {
        rosters[player.club][key].push(player.id);
      }
    }
  }

  const wikiMerged = mergeWikipediaSquads(rosters);

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
      if (isPlayableTeamYearRoster(ids, resolve)) {
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
          const matching = players.filter((p) => allowed.has(p.position)).length;
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

const playerById = buildPlayerIndex();
const rosters = buildRosters(playerById);
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
        "Player yearsActive spans (current-squads, historic-players, legends)",
        "Wikipedia-verified Era squads (era-wikipedia-squads.json)",
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
