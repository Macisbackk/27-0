import seedrandom from "seedrandom";
import type { SquadSlot } from "../types";
import { getPlayableClubNames } from "../clubs/super-league-display";
import { distributeSeasonTries } from "./season-tries";
import {
  calculateSquadStrength,
  DREAM_TEAM_NAME,
  simulateOneFixture,
  type MatchFixture,
  type MatchSimState,
} from "./season-simulation";
import type { PlayerTryTotal } from "./season-tries";
import type { BracketMatch } from "./challenge-cup-bracket";

export type CupFinish =
  | "Winners"
  | "Runners-Up"
  | "Semi Final"
  | "Quarter Final"
  | "Round of 16";

export const CUP_ROUND_NAMES = [
  "Round of 16",
  "Quarter Final",
  "Semi Final",
  "Final",
] as const;

export type CupRoundName = (typeof CUP_ROUND_NAMES)[number];

const PLAYABLE_CUP_STRENGTH: Record<string, number> = {
  "Wigan Warriors": 84,
  "St Helens": 83,
  "Leeds Rhinos": 81,
  "Warrington Wolves": 80,
  "Hull KR": 79,
  "Catalans Dragons": 78,
  "Hull FC": 76,
  "Toulouse Olympique": 76,
  "Leigh Leopards": 75,
  "York Knights": 74,
  "Huddersfield Giants": 73,
  "Castleford Tigers": 70,
  "Bradford Bulls": 69,
  "Wakefield Trinity": 66,
};

function buildCupOpponentPools(): string[][] {
  const sorted = [...getPlayableClubNames()].sort(
    (a, b) =>
      (PLAYABLE_CUP_STRENGTH[a] ?? 70) - (PLAYABLE_CUP_STRENGTH[b] ?? 70)
  );
  const pools: string[][] = [[], [], [], []];
  sorted.forEach((club, index) => {
    const poolIndex = Math.min(
      Math.floor((index / sorted.length) * pools.length),
      pools.length - 1
    );
    pools[poolIndex].push(club);
  });
  return pools.map((pool) => (pool.length > 0 ? pool : sorted.slice(0, 4)));
}

const CUP_OPPONENT_POOLS = buildCupOpponentPools();

export interface ChallengeCupResult {
  finish: CupFinish;
  resultLabel: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  fixtures: MatchFixture[];
  tryScorers: PlayerTryTotal[];
  squadStrength: number;
  insights: string[];
  isWinner: boolean;
  userClub?: string;
  byeTeams?: [string, string];
  bracketMatches?: BracketMatch[];
}

function pickCupOpponent(roundIndex: number, rng: () => number): string {
  const pool = CUP_OPPONENT_POOLS[roundIndex] ?? CUP_OPPONENT_POOLS[3];
  return pool[Math.floor(rng() * pool.length)];
}

function deriveCupFinish(
  roundReached: number,
  won: boolean
): { finish: CupFinish; label: string } {
  if (roundReached === 4 && won) {
    return { finish: "Winners", label: "Challenge Cup Winners" };
  }
  if (roundReached === 4) {
    return { finish: "Runners-Up", label: "Final Defeat" };
  }
  if (roundReached === 3) {
    return { finish: "Semi Final", label: "Semi Final Exit" };
  }
  if (roundReached === 2) {
    return { finish: "Quarter Final", label: "Quarter Final Exit" };
  }
  return { finish: "Round of 16", label: "Round of 16 Exit" };
}

export function simulateChallengeCup(
  squad: SquadSlot[],
  seed: string
): ChallengeCupResult {
  const rng = seedrandom(`${seed}-cup`);
  const strength = calculateSquadStrength(squad);
  const fixtures: MatchFixture[] = [];
  let state: MatchSimState = { form: 0, seasonDropGoals: 0 };
  let wins = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  let roundReached = 0;

  for (let i = 0; i < CUP_ROUND_NAMES.length; i++) {
    const opponent = pickCupOpponent(i, rng);
    const isHome = i % 2 === 0 || i === 3;
    roundReached = i + 1;

    const { fixture, state: nextState } = simulateOneFixture(
      squad,
      opponent,
      isHome,
      i + 1,
      `${seed}-cup`,
      state,
      { cupMode: true }
    );
    state = nextState;

    fixture.round = i + 1;
    fixtures.push(fixture);
    pointsFor += fixture.pointsFor;
    pointsAgainst += fixture.pointsAgainst;

    if (fixture.result === "W") {
      wins++;
    } else {
      const { finish, label } = deriveCupFinish(roundReached, false);
      const tryScorers = distributeSeasonTries(squad, fixtures, seed, wins);
      return {
        finish,
        resultLabel: label,
        matchesPlayed: fixtures.length,
        wins,
        losses: 1,
        pointsFor,
        pointsAgainst,
        fixtures,
        tryScorers,
        squadStrength: Math.round(strength * 10) / 10,
        insights: [],
        isWinner: false,
      };
    }
  }

  const { finish, label } = deriveCupFinish(4, true);
  const tryScorers = distributeSeasonTries(squad, fixtures, seed, wins);

  return {
    finish,
    resultLabel: label,
    matchesPlayed: fixtures.length,
    wins,
    losses: 0,
    pointsFor,
    pointsAgainst,
    fixtures,
    tryScorers,
    squadStrength: Math.round(strength * 10) / 10,
    insights: [],
    isWinner: true,
  };
}

export function formatCupFixtureScore(
  fixture: MatchFixture,
  userClub: string = DREAM_TEAM_NAME
): string {
  if (fixture.isHome) {
    return `${userClub} ${fixture.pointsFor} - ${fixture.pointsAgainst} ${fixture.opponent}`;
  }
  return `${fixture.opponent} ${fixture.pointsAgainst} - ${fixture.pointsFor} ${userClub}`;
}

export function getCupRoundLabel(round: number): CupRoundName {
  return CUP_ROUND_NAMES[round - 1] ?? "Final";
}
