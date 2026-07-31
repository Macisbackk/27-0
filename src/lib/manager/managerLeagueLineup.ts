import seedrandom from "seedrandom";
import { OPPONENT_LINEUP } from "../game/opponent-scorers";
import { getPlayerEligiblePositions } from "../players/player-positions";
import {
  getFormationSlotPosition,
  FORMATION_SLOT_POSITIONS,
} from "../positions";
import type { SquadSlot } from "../types";
import { ERA_BENCH_FROM_STARTING_17 } from "../players/era-starting-17s";
import type { Player, Position } from "../types";
import type { ManagerCareer } from "./types";
import { getManagerPlayer, reserveToPlayer } from "./managerPlayers";
import {
  getLeagueClubPlayerPool,
} from "./managerLeagueRosters";
import { toMatchdaySquadSlotsFromClubLineup } from "./matchday-lineup";
import {
  generateReservePlayer,
  ensureClubReserveDepth,
} from "./managerReserves";

const STARTING_XIII_SLOTS = 13;
const FULL_MATCHDAY = STARTING_XIII_SLOTS + ERA_BENCH_FROM_STARTING_17;

export type ClubMatchdayLineupSlot = {
  player: Player;
  position: Position;
};

export interface ClubMatchdayLineup {
  /** Slot-indexed starting XIII (index 0–12 matches team sheet layout). */
  xiii: Array<ClubMatchdayLineupSlot | undefined>;
  interchange: Player[];
  isUserClub: boolean;
  /** True when emergency generated players were needed to fill 17. */
  usedEmergencyPlayers?: boolean;
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

function createEmergencyOpponentPlayer(
  career: ManagerCareer,
  club: string,
  matchRound: number,
  index: number,
  position: Position
): Player {
  const reserve = generateReservePlayer(
    `${career.seed}-opp-fill-${club}-r${matchRound}`,
    index,
    position,
    club,
    0
  );
  const player = reserveToPlayer(reserve, career.seasonYear);
  return {
    ...player,
    club,
    id: `mgr-opp-emg-${career.seed}-${club}-${matchRound}-${index}`,
  };
}

/**
 * Always returns a full 13 + 4 matchday squad.
 * Falls back through first-team pool → flexible fills → emergency generated players.
 */
export function buildFullOpponentMatchdaySquad(
  career: ManagerCareer,
  club: string,
  matchRound: number
): ClubMatchdayLineup {
  const pool = getLeagueClubPlayerPool(career, club);
  const { xiii, usedIds } = buildBestAvailableXiiiFromPool(pool);
  let interchange = buildLeagueClubInterchange(
    pool,
    usedIds,
    career.seed,
    matchRound,
    club
  );

  for (const p of interchange) usedIds.add(p.id);

  let usedEmergency = false;
  let emergencyIndex = 0;

  for (let i = 0; i < STARTING_XIII_SLOTS; i++) {
    if (xiii[i]) continue;
    const position =
      OPPONENT_LINEUP[i] ??
      FORMATION_SLOT_POSITIONS[i] ??
      getFormationSlotPosition(i);
    const emergency = createEmergencyOpponentPlayer(
      career,
      club,
      matchRound,
      emergencyIndex++,
      position
    );
    usedIds.add(emergency.id);
    xiii[i] = { player: emergency, position };
    usedEmergency = true;
  }

  while (interchange.length < ERA_BENCH_FROM_STARTING_17) {
    const benchPos =
      FORMATION_SLOT_POSITIONS[interchange.length % FORMATION_SLOT_POSITIONS.length] ??
      "PROP";
    const leftover = pool.find((p) => !usedIds.has(p.id));
    if (leftover) {
      usedIds.add(leftover.id);
      interchange = [...interchange, leftover];
      continue;
    }
    const emergency = createEmergencyOpponentPlayer(
      career,
      club,
      matchRound,
      emergencyIndex++,
      benchPos
    );
    usedIds.add(emergency.id);
    interchange = [...interchange, emergency];
    usedEmergency = true;
  }

  if (usedEmergency && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      `[manager] Emergency players used to fill ${club} matchday squad (round ${matchRound}).`
    );
  }

  const filled =
    xiii.filter(Boolean).length + Math.min(interchange.length, ERA_BENCH_FROM_STARTING_17);
  if (filled < FULL_MATCHDAY && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      `[manager] ${club} matchday still short after emergency fill (${filled}/${FULL_MATCHDAY}).`
    );
  }

  return {
    xiii,
    interchange: interchange.slice(0, ERA_BENCH_FROM_STARTING_17),
    isUserClub: false,
    usedEmergencyPlayers: usedEmergency,
  };
}

function buildOpponentClubLineup(
  career: ManagerCareer,
  club: string,
  matchRound: number
): ClubMatchdayLineup {
  return buildFullOpponentMatchdaySquad(career, club, matchRound);
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
  const deepened = ensureClubReserveDepth(career, club);
  let lineup = buildOpponentClubLineup(deepened, club, matchRound);
  const check = validateTeamSheet(lineup, { requireStarting13: true });
  if (!check.ok) {
    lineup = repairTeamSheetWithReserves(
      deepened,
      club,
      lineup,
      matchRound
    );
  }
  return lineup;
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

export function validateTeamSheet(
  lineup: ClubMatchdayLineup,
  options?: { minPlayers?: number; requireStarting13?: boolean }
): {
  ok: boolean;
  filledStarters: number;
  filledBench: number;
  gaps: number[];
} {
  const requireStarting13 = options?.requireStarting13 ?? true;
  const minPlayers = options?.minPlayers ?? STARTING_XIII_SLOTS;
  const gaps: number[] = [];
  let filledStarters = 0;
  for (let i = 0; i < STARTING_XIII_SLOTS; i++) {
    if (lineup.xiii[i]?.player) filledStarters += 1;
    else gaps.push(i);
  }
  const filledBench = lineup.interchange.filter(Boolean).length;
  const ok = requireStarting13
    ? filledStarters >= STARTING_XIII_SLOTS
    : filledStarters + filledBench >= minPlayers;
  return { ok, filledStarters, filledBench, gaps };
}

export function repairTeamSheetWithReserves(
  career: ManagerCareer,
  club: string,
  lineup: ClubMatchdayLineup,
  matchRound: number
): ClubMatchdayLineup {
  return generateEmergencyPlayersIfStillShort(
    career,
    club,
    matchRound,
    lineup
  );
}

export function generateEmergencyPlayersIfStillShort(
  career: ManagerCareer,
  club: string,
  matchRound: number,
  lineup: ClubMatchdayLineup
): ClubMatchdayLineup {
  const xiii = [...lineup.xiii];
  let interchange = [...lineup.interchange];
  const usedIds = new Set<string>();
  for (const row of xiii) {
    if (row?.player) usedIds.add(row.player.id);
  }
  for (const p of interchange) usedIds.add(p.id);

  const pool = getLeagueClubPlayerPool(career, club);
  let usedEmergency = lineup.usedEmergencyPlayers ?? false;
  let emergencyIndex = 100;

  for (let i = 0; i < STARTING_XIII_SLOTS; i++) {
    if (xiii[i]?.player) continue;
    const position =
      OPPONENT_LINEUP[i] ??
      FORMATION_SLOT_POSITIONS[i] ??
      getFormationSlotPosition(i);
    const leftover = pool.find((p) => !usedIds.has(p.id));
    if (leftover) {
      usedIds.add(leftover.id);
      xiii[i] = { player: leftover, position };
      continue;
    }
    const emergency = createEmergencyOpponentPlayer(
      career,
      club,
      matchRound,
      emergencyIndex++,
      position
    );
    usedIds.add(emergency.id);
    xiii[i] = { player: emergency, position };
    usedEmergency = true;
  }

  while (interchange.length < ERA_BENCH_FROM_STARTING_17) {
    const benchPos =
      FORMATION_SLOT_POSITIONS[interchange.length % FORMATION_SLOT_POSITIONS.length] ??
      "PROP";
    const leftover = pool.find((p) => !usedIds.has(p.id));
    if (leftover) {
      usedIds.add(leftover.id);
      interchange = [...interchange, leftover];
      continue;
    }
    const emergency = createEmergencyOpponentPlayer(
      career,
      club,
      matchRound,
      emergencyIndex++,
      benchPos
    );
    usedIds.add(emergency.id);
    interchange = [...interchange, emergency];
    usedEmergency = true;
  }

  return {
    ...lineup,
    xiii,
    interchange: interchange.slice(0, ERA_BENCH_FROM_STARTING_17),
    usedEmergencyPlayers: usedEmergency,
  };
}

export { leagueGamesPlayed };
