import seedrandom from "seedrandom";
import {
  OPPONENT_LINEUP,
  selectClubMatchSquad,
} from "../game/opponent-scorers";
import { getFormationSlotDisplayLabel } from "../positions";
import type { SquadSlot } from "../types";
import { ERA_BENCH_FROM_STARTING_17 } from "../players/era-starting-17s";
import type { Player, Position } from "../types";
import type { ManagerCareer } from "./types";
import { getManagerPlayer } from "./managerPlayers";
import {
  getLeagueClubPlayerPool,
  getManagerOpponentPoolOptions,
} from "./managerLeagueRosters";

const STARTING_XIII_SLOTS = 13;

export type ClubMatchdayLineupSlot = {
  player: Player;
  position: Position;
};

export interface ClubMatchdayLineup {
  /** Slot-indexed starting XIII (index 0–12 matches team sheet layout). */
  xiii: Array<ClubMatchdayLineupSlot | undefined>;
  interchange: Player[];
  isUserClub: boolean;
}

export function getLineupXiiiPlayers(lineup: ClubMatchdayLineup): Player[] {
  return lineup.xiii
    .filter((row): row is ClubMatchdayLineupSlot => row != null)
    .map((row) => row.player);
}

/** RugbyPitch / TeamSheet slots for manager club sheet popups. */
export function clubLineupToSquadSlots(lineup: ClubMatchdayLineup): SquadSlot[] {
  return Array.from({ length: STARTING_XIII_SLOTS }, (_, slotIndex) => {
    const entry = lineup.xiii[slotIndex];
    const position =
      entry?.position ?? OPPONENT_LINEUP[slotIndex] ?? ("LOOSE_FORWARD" as Position);
    return {
      slotIndex,
      position,
      label: getFormationSlotDisplayLabel(slotIndex),
      player: entry?.player ?? null,
    };
  });
}

function buildOpponentXiii(
  selected: Player[]
): ClubMatchdayLineup["xiii"] {
  const xiii: ClubMatchdayLineup["xiii"] = new Array(STARTING_XIII_SLOTS);
  for (let i = 0; i < selected.length && i < STARTING_XIII_SLOTS; i++) {
    const player = selected[i]!;
    xiii[i] = {
      player,
      position: OPPONENT_LINEUP[i] ?? player.position,
    };
  }
  return xiii;
}

function leagueGamesPlayed(career: ManagerCareer): number {
  return Math.max(
    career.teamSeasonStats.played,
    career.fixtures.filter((f) => (f.competition ?? "league") !== "friendly")
      .length,
    1
  );
}

function buildUserClubLineup(career: ManagerCareer): ClubMatchdayLineup {
  const xiii: ClubMatchdayLineup["xiii"] = new Array(STARTING_XIII_SLOTS);
  for (let i = 0; i < career.matchdayXiii.length && i < STARTING_XIII_SLOTS; i++) {
    const playerId = career.matchdayXiii[i];
    const position = career.xiiiSlotPositions[i];
    if (!playerId || !position) continue;
    const player = getManagerPlayer(career, playerId);
    if (player) xiii[i] = { player, position };
  }

  const interchange: Player[] = [];
  for (const playerId of career.matchdayInterchange) {
    if (!playerId) continue;
    const player = getManagerPlayer(career, playerId);
    if (player) interchange.push(player);
  }

  return { xiii, interchange, isUserClub: true };
}

/** Deterministic starting XIII + interchange for a league club at the current save state. */
export function getClubMatchdayLineup(
  career: ManagerCareer,
  club: string,
  round?: number
): ClubMatchdayLineup {
  if (club === career.club) {
    return buildUserClubLineup(career);
  }

  const matchRound = round ?? Math.max(career.currentRound, career.gameWeek, 1);
  const options = getManagerOpponentPoolOptions(career, club);
  const selected = selectClubMatchSquad(club, career.seed, matchRound, options);
  const xiii = buildOpponentXiii(selected);

  const usedIds = new Set(selected.map((p) => p.id));
  const pool = getLeagueClubPlayerPool(career, club).filter(
    (p) => !usedIds.has(p.id)
  );
  const rng = seedrandom(`${career.seed}-club-bench-${matchRound}-${club}`);
  const ranked = [...pool].sort((a, b) => {
    const ra = a.peakRating;
    const rb = b.peakRating;
    if (rb !== ra) return rb - ra;
    return rng() - 0.5;
  });
  const candidates = ranked.slice(0, 10);
  candidates.sort(() => rng() - 0.5);
  const interchange = candidates.slice(0, ERA_BENCH_FROM_STARTING_17);

  return { xiii, interchange, isUserClub: false };
}

export function getClubSquadAverageRating(
  career: ManagerCareer,
  club: string,
  round?: number
): number {
  const lineup = getClubMatchdayLineup(career, club, round);
  const players = [...getLineupXiiiPlayers(lineup), ...lineup.interchange];
  if (players.length === 0) return 0;
  const total = players.reduce(
    (sum, p) => sum + p.peakRating,
    0
  );
  return Math.round(total / players.length);
}

export { leagueGamesPlayed };
