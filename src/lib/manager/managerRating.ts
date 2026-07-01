import { getTeamYearPool } from "../game/team-year-pools";
import { getCurrentSquadPlayerIds } from "../players/era-teams";
import { getPlayerById } from "../players";
import { getPlayerRatingForPosition } from "../players/player-positions";
import type { Position } from "../types";
import { buildDefaultLineup } from "./club-config";
import { getManagerPlayer } from "./managerPlayers";
import { getManagerModePlayerRating } from "./managerSquadRatings";
import type { ManagerCareer } from "./types";

const ERA_26_YEAR = "2026";

/** Manager Mode uses the 2026 team-year roster when available. */
export function getManagerRosterIds(club: string): string[] {
  const pool = getTeamYearPool(club, ERA_26_YEAR);
  if (pool && pool.playerIds.length >= 13) {
    return [...pool.playerIds];
  }
  return getCurrentSquadPlayerIds(club);
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const SPINE_POSITIONS = new Set<Position>([
  "FULLBACK",
  "STAND_OFF",
  "SCRUM_HALF",
  "HOOKER",
  "LOOSE_FORWARD",
]);

function playerBaseRating(playerId: string, career?: ManagerCareer): number {
  const p = career ? getManagerPlayer(career, playerId) : getPlayerById(playerId);
  if (!p) return 0;
  const base = p.rating ?? p.peakRating;
  return career ? base : getManagerModePlayerRating(p.name, base);
}

/**
 * teamRating = starting13 avg × 0.7 + interchange avg × 0.2 + spine bonus × 0.1
 * Uses base rating with no OOP penalty when player is valid at listed slot.
 */
export function computeManagerTeamRating(
  xiiiIds: string[],
  interchangeIds: string[],
  slotPositions: Position[],
  career?: ManagerCareer
): number {
  const starterRatings = xiiiIds.map((id, i) => {
    const pos = slotPositions[i];
    const p = career ? getManagerPlayer(career, id) : getPlayerById(id);
    if (!p || !pos) return playerBaseRating(id, career);
    return getPlayerRatingForPosition(p, pos);
  });

  const benchRatings = interchangeIds.map((id) => playerBaseRating(id, career));

  const spineRatings: number[] = [];
  for (let i = 0; i < xiiiIds.length; i++) {
    const pos = slotPositions[i];
    if (pos && SPINE_POSITIONS.has(pos)) {
      spineRatings.push(starterRatings[i]!);
    }
  }

  const starterAvg = avg(starterRatings.filter((r) => r > 0));
  const benchAvg =
    benchRatings.length > 0
      ? avg(benchRatings.filter((r) => r > 0))
      : starterAvg;
  const spineAvg =
    spineRatings.length > 0 ? avg(spineRatings) : starterAvg;

  if (starterAvg <= 0) return 0;

  const rating = starterAvg * 0.7 + benchAvg * 0.2 + spineAvg * 0.1;
  return Math.round(rating);
}

export function getManagerClubTeamRating(club: string): number {
  const rosterIds = getManagerRosterIds(club);
  const lineup = buildDefaultLineup(rosterIds);
  if (lineup) {
    return computeManagerTeamRating(
      lineup.xiiiIds,
      lineup.benchIds,
      lineup.slotPositions
    );
  }

  const top = rosterIds
    .map((id) => playerBaseRating(id))
    .filter((r) => r > 0)
    .sort((a, b) => b - a)
    .slice(0, 17);
  return top.length ? Math.round(avg(top)) : 0;
}

export function getManagerLineupForClub(club: string): {
  xiiiIds: string[];
  slotPositions: Position[];
  benchIds: string[];
} {
  const rosterIds = getManagerRosterIds(club);
  const lineup = buildDefaultLineup(rosterIds);
  if (lineup) return lineup;

  const xiiiIds = rosterIds.slice(0, 13);
  const slotPositions: Position[] = [
    "FULLBACK",
    "WING",
    "WING",
    "CENTRE",
    "CENTRE",
    "STAND_OFF",
    "SCRUM_HALF",
    "PROP",
    "HOOKER",
    "PROP",
    "SECOND_ROW",
    "LOOSE_FORWARD",
    "SECOND_ROW",
  ];
  return {
    xiiiIds,
    slotPositions,
    benchIds: rosterIds.slice(13, 17),
  };
}
