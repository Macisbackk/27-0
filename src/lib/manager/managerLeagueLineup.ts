import seedrandom from "seedrandom";
import { OPPONENT_LINEUP } from "../game/opponent-scorers";
import { getPlayerById } from "../players";
import { getPlayerEligiblePositions } from "../players/player-positions";
import {
  getFormationSlotPosition,
} from "../positions";
import type { SquadSlot } from "../types";
import { ERA_BENCH_FROM_STARTING_17 } from "../players/era-starting-17s";
import type { Player, Position } from "../types";
import type { ManagerCareer } from "./types";
import { buildDefaultLineup } from "./club-config";
import { getManagerPlayer } from "./managerPlayers";
import {
  getLeagueClubPlayerPool,
  getLeagueClubRosterIds,
} from "./managerLeagueRosters";
import { toMatchdaySquadSlotsFromClubLineup } from "./matchday-lineup";

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

/** RugbyPitch / TeamSheet slots — delegates to unified matchday-lineup converter. */
export function clubLineupToSquadSlots(
  lineup: ClubMatchdayLineup,
  career?: ManagerCareer
): SquadSlot[] {
  return toMatchdaySquadSlotsFromClubLineup(lineup, career);
}

function resolveLineupPlayer(
  career: ManagerCareer,
  playerId: string
): Player | undefined {
  return getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
}

function buildBestAvailableXiiiFromPool(pool: Player[]): {
  xiii: ClubMatchdayLineup["xiii"];
  usedIds: Set<string>;
} {
  const xiii: ClubMatchdayLineup["xiii"] = new Array(STARTING_XIII_SLOTS);
  const used = new Set<string>();
  const ranked = [...pool].sort((a, b) => b.peakRating - a.peakRating);

  for (let i = 0; i < STARTING_XIII_SLOTS; i++) {
    const position = OPPONENT_LINEUP[i] ?? getFormationSlotPosition(i);
    let candidates = ranked.filter(
      (p) =>
        !used.has(p.id) && getPlayerEligiblePositions(p).includes(position)
    );
    if (candidates.length === 0) {
      candidates = ranked.filter((p) => !used.has(p.id));
    }
    const pick = candidates[0];
    if (!pick) continue;
    used.add(pick.id);
    xiii[i] = { player: pick, position };
  }

  return { xiii, usedIds: used };
}

function idsLineupToClubMatchday(
  career: ManagerCareer,
  lineup: {
    xiiiIds: string[];
    slotPositions: Position[];
    benchIds: string[];
  }
): ClubMatchdayLineup {
  const xiii: ClubMatchdayLineup["xiii"] = new Array(STARTING_XIII_SLOTS);
  for (let i = 0; i < STARTING_XIII_SLOTS; i++) {
    const id = lineup.xiiiIds[i];
    if (!id) continue;
    const player = resolveLineupPlayer(career, id);
    if (!player) continue;
    xiii[i] = {
      player,
      position: lineup.slotPositions[i] ?? getFormationSlotPosition(i),
    };
  }

  const interchange: Player[] = [];
  for (const id of lineup.benchIds.slice(0, ERA_BENCH_FROM_STARTING_17)) {
    const player = resolveLineupPlayer(career, id);
    if (player) interchange.push(player);
  }

  return { xiii, interchange, isUserClub: false };
}

function buildLeagueClubInterchange(
  pool: Player[],
  usedIds: Set<string>,
  seed: string,
  matchRound: number,
  club: string
): Player[] {
  const ranked = pool
    .filter((p) => !usedIds.has(p.id))
    .sort((a, b) => b.peakRating - a.peakRating);
  if (ranked.length <= ERA_BENCH_FROM_STARTING_17) {
    return ranked;
  }
  const rng = seedrandom(`${seed}-club-bench-${matchRound}-${club}`);
  const candidates = ranked.slice(0, 10);
  candidates.sort(() => rng() - 0.5);
  return candidates.slice(0, ERA_BENCH_FROM_STARTING_17);
}

function buildOpponentClubLineup(
  career: ManagerCareer,
  club: string,
  matchRound: number
): ClubMatchdayLineup {
  const rosterIds = getLeagueClubRosterIds(career, club);
  const pool = getLeagueClubPlayerPool(career, club);
  const canonical = buildDefaultLineup(rosterIds);

  if (
    canonical &&
    canonical.xiiiIds.filter(Boolean).length === STARTING_XIII_SLOTS
  ) {
    const fromCanonical = idsLineupToClubMatchday(career, canonical);
    if (getLineupXiiiPlayers(fromCanonical).length === STARTING_XIII_SLOTS) {
      return fromCanonical;
    }
  }

  const { xiii, usedIds } = buildBestAvailableXiiiFromPool(pool);
  const interchange = buildLeagueClubInterchange(
    pool,
    usedIds,
    career.seed,
    matchRound,
    club
  );

  return { xiii, interchange, isUserClub: false };
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
    const position =
      career.xiiiSlotPositions[i] ?? getFormationSlotPosition(i);
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
  return buildOpponentClubLineup(career, club, matchRound);
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
