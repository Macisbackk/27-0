import seedrandom from "seedrandom";
import {
  OPPONENT_LINEUP,
  selectClubMatchSquad,
} from "../game/opponent-scorers";
import { ERA_BENCH_FROM_STARTING_17 } from "../players/era-starting-17s";
import type { Player, Position } from "../types";
import type { ManagerCareer } from "./types";
import { getManagerPlayer } from "./managerPlayers";
import {
  getLeagueClubPlayerPool,
  getManagerOpponentPoolOptions,
} from "./managerLeagueRosters";

export interface ClubMatchdayLineup {
  xiii: Array<{ player: Player; position: Position }>;
  interchange: Player[];
  isUserClub: boolean;
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
  const xiii: ClubMatchdayLineup["xiii"] = [];
  for (let i = 0; i < career.matchdayXiii.length; i++) {
    const playerId = career.matchdayXiii[i];
    const position = career.xiiiSlotPositions[i];
    if (!playerId || !position) continue;
    const player = getManagerPlayer(career, playerId);
    if (player) xiii.push({ player, position });
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
  const xiii: ClubMatchdayLineup["xiii"] = selected.map((player, index) => ({
    player,
    position: OPPONENT_LINEUP[index] ?? player.position,
  }));

  const usedIds = new Set(selected.map((p) => p.id));
  const pool = getLeagueClubPlayerPool(career, club).filter(
    (p) => !usedIds.has(p.id)
  );
  const rng = seedrandom(`${career.seed}-club-bench-${matchRound}-${club}`);
  const ranked = [...pool].sort((a, b) => {
    const ra = a.rating ?? a.peakRating;
    const rb = b.rating ?? b.peakRating;
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
  const players = [
    ...lineup.xiii.map((row) => row.player),
    ...lineup.interchange,
  ];
  if (players.length === 0) return 0;
  const total = players.reduce(
    (sum, p) => sum + (p.rating ?? p.peakRating),
    0
  );
  return Math.round(total / players.length);
}

export { leagueGamesPlayed };
