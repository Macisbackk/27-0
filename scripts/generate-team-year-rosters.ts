/**
 * Build strict team-year roster pools — verified squads + current-year squads only.
 * No career-span expansion. No clubsPlayedFor leakage.
 *
 * Run: npm run build:team-year-rosters
 */
import { writeFileSync } from "fs";
import { join } from "path";
import currentSquads from "../data/current-squads.json";
import currentTeamYearSquads2026 from "../data/current-team-year-squads-2026.json";
import eraWikipediaSquads from "../data/era-wikipedia-squads.json";
import slVerifiedSquads from "../data/sl-era-verified-squads.json";
import historicPlayers from "../data/historic-players.json";
import legends from "../data/legends.json";
import {
  isCurrentPlayableClub,
  isEraPlayableClub,
} from "../src/lib/clubs/super-league-display";
import { findPlayerForTeamYearSquad } from "../src/lib/players/player-name-resolve";
import { getPlayerById } from "../src/lib/players";
import { isSuperLeagueSeason } from "../src/lib/players/super-league-club-years";
import { normalizePlayer } from "../src/lib/players/normalize";
import {
  isPlayableTeamYearRoster,
  MIN_TEAM_YEAR_ROSTER_PLAYERS,
  getTeamYearRecruitPosition,
} from "../src/lib/players/team-year-roster-playable";
import { describeTeamYearMembershipMismatch, playerBelongsToTeamYear } from "../src/lib/players/team-year-membership";
import { getRecruitListPositionsForSlot } from "../src/lib/game/position-placement";
import { SQUAD_STRUCTURE } from "../src/lib/positions";
import type { Player } from "../src/lib/types";

export type TeamYearRosters = Record<string, Record<string, string[]>>;

export type TeamYearRosterMeta = {
  source: "verified" | "current-squad";
  isSuperLeagueSeason: boolean;
  isCurrentSeason?: boolean;
  playableInNormalSpin: boolean;
  playableInEra: boolean;
  playableInEraChallengeCup?: boolean;
  playerCount: number;
  verifiedSource?: string;
};

export type TeamYearRostersMetaFile = Record<
  string,
  Record<string, TeamYearRosterMeta>
>;

const CURRENT_YEAR = new Date().getFullYear();

type VerifiedSquad = {
  playerIds: string[];
  source?: string;
  positions?: string[];
  wikipediaPlayers?: string[];
};

type VerifiedSquads = Record<string, Record<string, VerifiedSquad>>;

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

function resolveVerifiedSquadPlayerIds(
  team: string,
  year: string,
  entry: VerifiedSquad,
  playerById: Map<string, Player>
): {
  valid: string[];
  rejected: Array<{ id: string; reason: string }>;
  unresolvedNames: string[];
} {
  const rejected: Array<{ id: string; reason: string }> = [];
  const unresolvedNames: string[] = [];
  const usedIds = new Set<string>();
  const valid: string[] = [];
  const players = [...playerById.values()];

  const wikiNames = entry.wikipediaPlayers ?? [];
  const sourceIds = entry.playerIds ?? [];

  for (let i = 0; i < 13; i++) {
    const id = sourceIds[i];
    const wikiName = wikiNames[i];
    let resolved: Player | null = null;

    if (id) {
      const byId = playerById.get(id);
      if (byId && playerBelongsToTeamYear(byId, team, year)) {
        resolved = byId;
      } else if (byId) {
        rejected.push({
          id,
          reason:
            describeTeamYearMembershipMismatch(byId, team, year) ??
            "membership mismatch",
        });
      } else if (id) {
        rejected.push({ id, reason: "unknown player id" });
      }
    }

    if (!resolved && wikiName) {
      resolved = findPlayerForTeamYearSquad(wikiName, team, year, {
        excludeIds: usedIds,
        players,
      });
      if (!resolved) {
        unresolvedNames.push(wikiName);
      }
    } else if (!resolved && !wikiName && id) {
      unresolvedNames.push(id);
    }

    if (resolved) {
      usedIds.add(resolved.id);
      valid.push(resolved.id);
    }
  }

  return { valid, rejected, unresolvedNames };
}

function filterVerifiedPlayerIds(
  team: string,
  year: string,
  playerIds: string[],
  playerById: Map<string, Player>
): { valid: string[]; rejected: Array<{ id: string; reason: string }> } {
  const valid: string[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];

  for (const id of playerIds) {
    const player = playerById.get(id);
    if (!player) {
      rejected.push({ id, reason: "unknown player id" });
      continue;
    }
    if (playerBelongsToTeamYear(player, team, year)) {
      valid.push(id);
      continue;
    }
    rejected.push({
      id,
      reason:
        describeTeamYearMembershipMismatch(player, team, year) ??
        "membership mismatch",
    });
  }

  if (valid.length === 13) {
    return { valid, rejected };
  }

  const allKnown = playerIds.every((id) => playerById.has(id));
  if (allKnown && playerIds.length === 13) {
    return { valid: [...playerIds], rejected };
  }

  return { valid, rejected };
}

function mergeVerifiedSquads(
  rosters: TeamYearRosters,
  meta: TeamYearRostersMetaFile,
  playerById: Map<string, Player>
): {
  merged: number;
  rejectedPlayers: Array<{ team: string; year: string; id: string; reason: string }>;
  unresolvedSquads: Array<{ team: string; year: string; names: string[] }>;
} {
  let merged = 0;
  const rejectedPlayers: Array<{ team: string; year: string; id: string; reason: string }> = [];
  const unresolvedSquads: Array<{ team: string; year: string; names: string[] }> = [];
  const sources = [
    eraWikipediaSquads as VerifiedSquads,
    slVerifiedSquads as VerifiedSquads,
  ];

  for (const wiki of sources) {
    for (const [team, years] of Object.entries(wiki)) {
      if (!meta[team]) meta[team] = {};
      for (const [year, entry] of Object.entries(years)) {
        if (!entry?.playerIds || entry.playerIds.length !== 13) continue;
        if (!isSuperLeagueSeason(team, year)) continue;
        if (!isEraPlayableClub(team) && !isCurrentPlayableClub(team)) continue;

        const resolved = resolveVerifiedSquadPlayerIds(
          team,
          year,
          entry,
          playerById
        );
        for (const r of resolved.rejected) {
          rejectedPlayers.push({ team, year, id: r.id, reason: r.reason });
        }

        let valid = resolved.valid;
        if (valid.length !== 13) {
          const fallback = filterVerifiedPlayerIds(
            team,
            year,
            entry.playerIds,
            playerById
          );
          for (const r of fallback.rejected) {
            rejectedPlayers.push({ team, year, id: r.id, reason: r.reason });
          }
          if (fallback.valid.length === 13) {
            valid = fallback.valid;
          }
        }

        if (valid.length !== 13) {
          if (resolved.unresolvedNames.length > 0) {
            unresolvedSquads.push({
              team,
              year,
              names: resolved.unresolvedNames,
            });
          }
          continue;
        }

        if (!rosters[team]) rosters[team] = {};
        rosters[team][year] = [...valid].sort((a, b) => a.localeCompare(b));

        meta[team][year] = {
          source: "verified",
          isSuperLeagueSeason: true,
          playableInNormalSpin: false,
          playableInEra: isEraPlayableClub(team),
          playerCount: 13,
          verifiedSource: entry.source,
        };
        merged++;
      }
    }
  }

  return { merged, rejectedPlayers, unresolvedSquads };
}

function scrubUnresolvedRosterIds(rosters: TeamYearRosters): void {
  for (const team of Object.keys(rosters)) {
    for (const year of Object.keys(rosters[team])) {
      rosters[team][year] = rosters[team][year]!.filter(
        (id) => getPlayerById(id) !== undefined
      );
      if (rosters[team][year]!.length === 0) {
        delete rosters[team][year];
      }
    }
    if (Object.keys(rosters[team]).length === 0) {
      delete rosters[team];
    }
  }
}

export const CURRENT_YEAR_SQUAD_SIZE = 17;

type CurrentTeamYearSquads = Record<
  string,
  Record<
    string,
    {
      playerIds: string[];
      positions?: string[];
      isCurrentSeason?: boolean;
      playableInNormalSpin?: boolean;
      playableInEra?: boolean;
      playableInEraChallengeCup?: boolean;
      source?: string;
    }
  >
>;

function buildCurrentYearSquads(
  rosters: TeamYearRosters,
  meta: TeamYearRostersMetaFile,
  playerById: Map<string, Player>
): number {
  const year = String(CURRENT_YEAR);
  let built = 0;
  const squads = currentTeamYearSquads2026 as CurrentTeamYearSquads;

  for (const [club, years] of Object.entries(squads)) {
    const entry = years[year];
    if (!entry?.playerIds?.length) continue;
    if (!isSuperLeagueSeason(club, year)) continue;

    const knownIds = entry.playerIds.filter((id) => {
      const player = playerById.get(id);
      return !!player && player.category === "current";
    });

    if (knownIds.length !== CURRENT_YEAR_SQUAD_SIZE) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `${club} ${year}: expected ${CURRENT_YEAR_SQUAD_SIZE} players, got ${knownIds.length}`
        );
      }
      continue;
    }

    if (!rosters[club]) rosters[club] = {};
    rosters[club][year] = [...knownIds].sort((a, b) => a.localeCompare(b));

    const playableRoster = isPlayableTeamYearRoster(
      club,
      year,
      knownIds,
      (id) => playerById.get(id)
    );

    if (!meta[club]) meta[club] = {};
    meta[club][year] = {
      source: "current-squad",
      isSuperLeagueSeason: true,
      isCurrentSeason: entry.isCurrentSeason ?? true,
      playableInNormalSpin: playableRoster && (entry.playableInNormalSpin ?? true),
      playableInEra: playableRoster && (entry.playableInEra ?? true),
      playableInEraChallengeCup: entry.playableInEraChallengeCup ?? true,
      playerCount: knownIds.length,
    };

    if (!playableRoster) {
      delete rosters[club][year];
      meta[club][year].playableInNormalSpin = false;
      meta[club][year].playableInEra = false;
    } else {
      built++;
    }
  }

  return built;
}

function finalizePlayability(
  rosters: TeamYearRosters,
  meta: TeamYearRostersMetaFile,
  playerById: Map<string, Player>
): { playable: Array<{ team: string; year: string; count: number }>; hidden: Array<{ team: string; year: string; reason: string }> } {
  const playable: Array<{ team: string; year: string; count: number }> = [];
  const hidden: Array<{ team: string; year: string; reason: string }> = [];

  for (const team of Object.keys(meta).sort()) {
    for (const year of Object.keys(meta[team]).sort(
      (a, b) => Number(a) - Number(b)
    )) {
      const entry = meta[team][year]!;
      const ids = rosters[team]?.[year] ?? [];

      if (!isSuperLeagueSeason(team, year)) {
        entry.isSuperLeagueSeason = false;
        entry.playableInNormalSpin = false;
        entry.playableInEra = false;
        delete rosters[team]?.[year];
        hidden.push({ team, year, reason: "not a Super League season" });
        continue;
      }

      if (entry.source === "verified") {
        const ok =
          isEraPlayableClub(team) &&
          isPlayableTeamYearRoster(team, year, ids, (id) =>
            playerById.get(id)
          );
        entry.playableInNormalSpin = false;
        entry.playableInEra = ok;
        entry.playerCount = ids.length;

        if (!ok) {
          delete rosters[team]?.[year];
          hidden.push({ team, year, reason: "verified squad failed playability gate" });
        } else {
          playable.push({ team, year, count: ids.length });
        }
        continue;
      }

      if (entry.playableInNormalSpin && isCurrentPlayableClub(team)) {
        playable.push({ team, year, count: ids.length });
      } else {
        entry.playableInNormalSpin = false;
        if (entry.isCurrentSeason) {
          hidden.push({ team, year, reason: "incomplete current squad pool" });
        }
      }
    }
  }

  return { playable, hidden };
}

function auditMembership(
  rosters: TeamYearRosters,
  playerById: Map<string, Player>
): Array<{ team: string; year: string; playerId: string; message: string }> {
  const mismatches: Array<{
    team: string;
    year: string;
    playerId: string;
    message: string;
  }> = [];

  for (const team of Object.keys(rosters).sort()) {
    for (const year of Object.keys(rosters[team]).sort(
      (a, b) => Number(a) - Number(b)
    )) {
      for (const id of rosters[team][year]!) {
        const player = playerById.get(id);
        if (!player) continue;
        const message = describeTeamYearMembershipMismatch(player, team, year);
        if (message) {
          mismatches.push({ team, year, playerId: id, message });
        }
      }
    }
  }

  return mismatches;
}

function auditIncomplete(
  rosters: TeamYearRosters,
  playerById: Map<string, Player>
) {
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
      if (isPlayableTeamYearRoster(team, year, ids, (id) => playerById.get(id))) {
        continue;
      }

      let reason = "unknown";
      if (ids.length < MIN_TEAM_YEAR_ROSTER_PLAYERS) {
        reason = `fewer than ${MIN_TEAM_YEAR_ROSTER_PLAYERS} players`;
      } else {
        const players = ids
          .map((id) => playerById.get(id))
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

  return incomplete;
}

const playerById = buildPlayerIndex();
const rosters: TeamYearRosters = {};
const meta: TeamYearRostersMetaFile = {};

const verifiedCount = mergeVerifiedSquads(rosters, meta, playerById);
const currentCount = buildCurrentYearSquads(rosters, meta, playerById);
scrubUnresolvedRosterIds(rosters);
const { playable, hidden } = finalizePlayability(rosters, meta, playerById);
const membershipMismatches = auditMembership(rosters, playerById);

const dataDir = join(process.cwd(), "data");
writeFileSync(
  join(dataDir, "team-year-rosters.json"),
  `${JSON.stringify(rosters, null, 2)}\n`
);
writeFileSync(
  join(dataDir, "team-year-rosters-meta.json"),
  `${JSON.stringify(meta, null, 2)}\n`
);
writeFileSync(
  join(dataDir, "team-year-rosters-audit.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sources: [
        "Verified Wikipedia/manual XIII only (era-wikipedia-squads.json, sl-era-verified-squads.json)",
        `Current squad for ${CURRENT_YEAR} only (current-squads.json)`,
        "Super League season gate (super-league-club-years.json)",
      ],
      minPlayers: MIN_TEAM_YEAR_ROSTER_PLAYERS,
      verifiedSquadsMerged: verifiedCount.merged,
      verifiedPlayersRejected: verifiedCount.rejectedPlayers.length,
      unresolvedSquads: verifiedCount.unresolvedSquads,
      currentYearSquadsBuilt: currentCount,
      playableCount: playable.length,
      hiddenCount: hidden.length,
      playable,
      hidden,
      membershipMismatches,
      incomplete: auditIncomplete(rosters, playerById),
    },
    null,
    2
  )}\n`
);

console.log(`Wrote data/team-year-rosters.json`);
console.log(`Wrote data/team-year-rosters-meta.json`);
console.log(`Verified squads: ${verifiedCount.merged} | Current-year squads: ${currentCount}`);
console.log(
  `Playable team-years: ${playable.length} | Hidden: ${hidden.length}`
);
if (membershipMismatches.length > 0) {
  console.warn(
    `Membership mismatches in playable rosters: ${membershipMismatches.length}`
  );
  for (const m of membershipMismatches.slice(0, 10)) {
    console.warn(`  ${m.team} ${m.year} ${m.playerId}: ${m.message}`);
  }
}
