import seedrandom from "seedrandom";
import type { Position } from "../types";
import { FORMATION_SLOT_POSITIONS } from "../positions";
import {
  generateNrlSquadNames,
  getNrlClubByName,
  nrlStrengthTierToBaseRating,
} from "./nrlClubs";

export interface NrlMatchdayPlayer {
  id: string;
  name: string;
  position: Position;
  rating: number;
  /** 0–12 starter, 13–16 bench. */
  slot: number;
}

export interface NrlMatchdayLineup {
  teamName: string;
  teamRating: number;
  players: NrlMatchdayPlayer[];
}

const BENCH_POSITIONS: Position[] = [
  "HOOKER",
  "PROP",
  "SECOND_ROW",
  "LOOSE_FORWARD",
];

/**
 * Full 17-man NRL matchday squad with per-player ratings that average to
 * the club's champion rating. Used for both display and simulation strength.
 */
export function buildNrlMatchdayLineup(params: {
  seed: string;
  teamName: string;
  teamRating?: number;
  seasonYear?: number;
  count?: number;
}): NrlMatchdayLineup {
  const count = params.count ?? 17;
  const club = getNrlClubByName(params.teamName);
  const rng = seedrandom(
    `${params.seed}-nrl-lineup-${params.teamName}-y${params.seasonYear ?? 0}`
  );

  const target =
    params.teamRating ??
    (club
      ? nrlStrengthTierToBaseRating(club.strengthTier)
      : 89);

  const names = generateNrlSquadNames(params.seed, params.teamName, count);
  if (names.length < 13) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[WCC] NRL name generation underfilled for ${params.teamName}: ${names.length}`
      );
    }
  }

  const rawOffsets = Array.from({ length: Math.max(names.length, count) }, () =>
    Math.floor(rng() * 7) - 3
  );
  const meanOffset =
    rawOffsets.reduce((a, b) => a + b, 0) / Math.max(1, rawOffsets.length);

  const players: NrlMatchdayPlayer[] = names.map((p, i) => {
    const position =
      i < 13
        ? (FORMATION_SLOT_POSITIONS[i] ?? "CENTRE")
        : (BENCH_POSITIONS[(i - 13) % BENCH_POSITIONS.length] ?? "PROP");
    const adjusted = Math.round(
      target + (rawOffsets[i] ?? 0) - meanOffset - (i >= 13 ? 1.5 : 0)
    );
    return {
      id: p.id,
      name: p.name,
      position,
      rating: Math.max(78, Math.min(99, adjusted)),
      slot: i,
    };
  });

  // Top up to 13 starters if names were short — log, don't invent elite ghosts.
  while (players.length < 13) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[WCC] Padding incomplete NRL lineup for ${params.teamName} at slot ${players.length}`
      );
    }
    const i = players.length;
    players.push({
      id: `nrl-pad-${params.teamName}-${i}`,
      name: `${params.teamName} Player ${i + 1}`,
      position: FORMATION_SLOT_POSITIONS[i] ?? "CENTRE",
      rating: Math.max(78, target - 4),
      slot: i,
    });
  }

  return {
    teamName: params.teamName,
    teamRating: computeNrlLineupTeamRating({
      teamRating: target,
      players,
    }),
    players,
  };
}

/**
 * Same weighting spirit as computeManagerTeamRating:
 * starters 70% / bench 20% / spine 10%.
 */
export function computeNrlLineupTeamRating(
  lineup: Pick<NrlMatchdayLineup, "players" | "teamRating">
): number {
  const starters = lineup.players.filter((p) => p.slot < 13);
  const bench = lineup.players.filter((p) => p.slot >= 13);
  if (starters.length === 0) {
    return lineup.teamRating;
  }

  const starterAvg =
    starters.reduce((s, p) => s + p.rating, 0) / starters.length;
  const benchAvg =
    bench.length > 0
      ? bench.reduce((s, p) => s + p.rating, 0) / bench.length
      : starterAvg - 2;

  const spineSlots = [6, 7, 12, 8]; // SO, SH, LF, hooker-ish coverage
  const spine = starters.filter((p) => spineSlots.includes(p.slot));
  const spineAvg =
    spine.length > 0
      ? spine.reduce((s, p) => s + p.rating, 0) / spine.length
      : starterAvg;

  return Math.round(starterAvg * 0.7 + benchAvg * 0.2 + spineAvg * 0.1);
}
