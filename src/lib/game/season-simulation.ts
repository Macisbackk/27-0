import seedrandom from "seedrandom";
import { SUPER_LEAGUE_CLUBS } from "../clubs";
import type { SquadSlot } from "../types";
import { getAverageSquadRating } from "../squad-analysis";
import { getSquadValue } from "../positions";
import { isGoatPlayer } from "../players/goat";
import {
  distributeSeasonTries,
  type PlayerTryTotal,
} from "./season-tries";
import {
  decomposeRLScore,
  pickRLScore,
  scoreHasDropGoal,
  snapToRLScore,
  type ScoreBreakdown,
  type ScorePickContext,
} from "./rl-scores";
import { getSeasonCommentary } from "./season-commentary";

export const SEASON_GAMES = 27;
export const DREAM_TEAM_NAME = "Dream Team";

interface AttackProfile {
  winForMin: number;
  winForMax: number;
  winAgainstMin: number;
  winAgainstMax: number;
  lossForMin: number;
  lossForMax: number;
  lossAgainstMin: number;
  lossAgainstMax: number;
}

function getAttackProfile(strength: number): AttackProfile {
  if (strength >= 85) {
    return {
      winForMin: 18,
      winForMax: 42,
      winAgainstMin: 0,
      winAgainstMax: 20,
      lossForMin: 10,
      lossForMax: 24,
      lossAgainstMin: 14,
      lossAgainstMax: 28,
    };
  }
  if (strength >= 72) {
    return {
      winForMin: 16,
      winForMax: 38,
      winAgainstMin: 6,
      winAgainstMax: 28,
      lossForMin: 10,
      lossForMax: 24,
      lossAgainstMin: 18,
      lossAgainstMax: 34,
    };
  }
  if (strength >= 58) {
    return {
      winForMin: 12,
      winForMax: 28,
      winAgainstMin: 8,
      winAgainstMax: 26,
      lossForMin: 6,
      lossForMax: 20,
      lossAgainstMin: 20,
      lossAgainstMax: 38,
    };
  }
  return {
    winForMin: 8,
    winForMax: 22,
    winAgainstMin: 10,
    winAgainstMax: 24,
    lossForMin: 0,
    lossForMax: 16,
    lossAgainstMin: 22,
    lossAgainstMax: 44,
  };
}

type SquadTier = "elite" | "average" | "weak";
type MatchType =
  | "low"
  | "normal"
  | "high"
  | "blowout"
  | "upset_loss"
  | "upset_win"
  | "grinding";

export interface FixtureTryScorer {
  playerId: string;
  name: string;
  tries: number;
}

export interface FixtureKicking {
  playerId: string;
  name: string;
  conversions: number;
  conversionAttempts: number;
  penalties: number;
  dropGoals: number;
}

export interface TeamScoringDetail {
  tryScorers: FixtureTryScorer[];
  kicking: FixtureKicking | null;
}

export interface FixtureScoringDetail {
  dreamTeam: TeamScoringDetail;
  opponent: TeamScoringDetail;
}

export interface MatchFixture {
  round: number;
  opponent: string;
  isHome: boolean;
  pointsFor: number;
  pointsAgainst: number;
  triesFor: number;
  triesAgainst: number;
  scoringFor: ScoreBreakdown;
  scoringAgainst: ScoreBreakdown;
  result: "W" | "L";
  isUpset?: boolean;
  isThrashing?: boolean;
  scoringDetail?: FixtureScoringDetail;
}

export interface SeasonResult {
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDifference: number;
  leaguePosition: number;
  isPerfect: boolean;
  longestWinStreak: number;
  longestLosingStreak: number;
  gameResults: ("W" | "L")[];
  fixtures: MatchFixture[];
  squadStrength: number;
  tryScorers: PlayerTryTotal[];
  insights: string[];
}

const FORWARD_POSITIONS = new Set([
  "PROP",
  "HOOKER",
  "SECOND_ROW",
  "LOOSE_FORWARD",
]);

const OPPONENT_CLUBS = SUPER_LEAGUE_CLUBS.filter((c) => c.active !== false).map(
  (c) => c.name
);

/** Approximate club strength tiers for opponent modelling. */
const CLUB_STRENGTH: Record<string, number> = {
  "Wigan Warriors": 84,
  "St Helens": 83,
  "Leeds Rhinos": 81,
  "Warrington Wolves": 80,
  "Hull KR": 79,
  "Catalans Dragons": 78,
  "Hull FC": 76,
  "Leigh Leopards": 75,
  "Huddersfield Giants": 73,
  "Salford Red Devils": 72,
  "Castleford Tigers": 70,
  "Bradford Bulls": 69,
  "Wakefield Trinity": 66,
  "London Broncos": 60,
  "Widnes Vikings": 62,
  "Halifax Panthers": 61,
  "York Knights": 74,
  "Toulouse Olympique": 76,
};

function getOpponentStrength(opponent: string, rng: () => number): number {
  const base = CLUB_STRENGTH[opponent] ?? 70;
  return base + (rng() - 0.5) * 8;
}

function getSquadTier(strength: number): SquadTier {
  if (strength >= 80) return "elite";
  if (strength >= 62) return "average";
  return "weak";
}

export function calculateSquadStrength(squad: SquadSlot[]): number {
  const players = squad.filter((s) => s.player).map((s) => s.player!);
  if (players.length === 0) return 0;

  const avgRating = getAverageSquadRating(squad);
  const totalValue = getSquadValue(squad);
  const legendCount = players.filter((p) => p.category === "legend").length;
  const hasGoat = players.some(isGoatPlayer);

  const valueScore = Math.min(totalValue / 5_500_000, 1.2) * 32;
  const ratingScore = (avgRating / 95) * 38;
  const legendBonus = legendCount * 3.5;
  const goatBonus = hasGoat ? 18 : 0;
  const balanceBonus = players.length === 13 ? 8 : 0;

  const forwardCount = players.filter((p) =>
    FORWARD_POSITIONS.has(p.position)
  ).length;
  const backCount = players.length - forwardCount;
  const balancePenalty =
    forwardCount < 5 || backCount < 5 ? -4 : forwardCount >= 6 ? 2 : 0;

  return Math.min(
    100,
    Math.max(
      0,
      ratingScore + valueScore + legendBonus + goatBonus + balanceBonus + balancePenalty
    )
  );
}

function shouldAllowDropGoal(
  matchType: MatchType,
  seasonDropGoals: number,
  rng: () => number
): boolean {
  if (seasonDropGoals >= 5) return false;
  const closeTypes: MatchType[] = [
    "grinding",
    "upset_loss",
    "low",
    "upset_win",
  ];
  if (!closeTypes.includes(matchType)) return false;
  return rng() < 0.09;
}

function ensureDecisive(
  pointsFor: number,
  pointsAgainst: number,
  won: boolean,
  allowDropGoal: boolean
): { pointsFor: number; pointsAgainst: number } {
  let pf = snapToRLScore(pointsFor, allowDropGoal);
  let pa = snapToRLScore(pointsAgainst, allowDropGoal);

  if (pf === pa) {
    return won
      ? { pointsFor: snapToRLScore(pf + 2, allowDropGoal), pointsAgainst: pa }
      : { pointsFor: pf, pointsAgainst: snapToRLScore(pa + 2, allowDropGoal) };
  }
  if (won && pf < pa) {
    return {
      pointsFor: snapToRLScore(pa + 2, allowDropGoal),
      pointsAgainst: pa,
    };
  }
  if (!won && pf > pa) {
    return {
      pointsFor: snapToRLScore(pa - 2, allowDropGoal),
      pointsAgainst: pa,
    };
  }
  return { pointsFor: pf, pointsAgainst: pa };
}

function pickTeamScore(
  min: number,
  max: number,
  rng: () => number,
  context: ScorePickContext
): number {
  return pickRLScore(min, max, rng, context);
}

function pickMatchType(
  squadStrength: number,
  opponentStrength: number,
  won: boolean,
  isUpset: boolean,
  rng: () => number
): MatchType {
  if (isUpset) return won ? "upset_win" : "upset_loss";

  const margin = squadStrength - opponentStrength;

  if (won && margin > 16 && rng() < 0.38) return "blowout";
  if (won && margin > 10 && rng() < 0.22) return "high";
  if (!won && margin < -6 && rng() < 0.25) return "high";
  if (rng() < 0.14) return "low";
  if (rng() < 0.2) return "grinding";
  return "normal";
}

function getFormScoringModifier(form: number, won: boolean): number {
  if (!won) {
    if (form <= -8) return 0.72;
    if (form <= -5) return 0.82;
    if (form <= -2) return 0.92;
    return 1;
  }
  if (form >= 8) return 1.06;
  if (form >= 4) return 1.03;
  return 1;
}

function generateScoreline(
  squadStrength: number,
  opponentStrength: number,
  won: boolean,
  matchType: MatchType,
  rng: () => number,
  seasonDropGoals: number,
  form: number
): {
  pointsFor: number;
  pointsAgainst: number;
  triesFor: number;
  triesAgainst: number;
  scoringFor: ScoreBreakdown;
  scoringAgainst: ScoreBreakdown;
  isThrashing: boolean;
  dropGoalsInMatch: number;
} {
  let pointsFor: number;
  let pointsAgainst: number;
  let isThrashing = false;

  const profile = getAttackProfile(squadStrength);
  const oppFactor = Math.max(0.7, Math.min(1.3, opponentStrength / 72));
  const allowDg = shouldAllowDropGoal(matchType, seasonDropGoals, rng);
  const dgContext: ScorePickContext = { allowDropGoal: allowDg };
  const noDg: ScorePickContext = { allowDropGoal: false };

  switch (matchType) {
    case "blowout":
      pointsFor = pickTeamScore(
        Math.max(profile.winForMin, 38),
        Math.min(profile.winForMax, 58),
        rng,
        noDg
      );
      pointsAgainst = pickTeamScore(
        0,
        Math.min(14, profile.winAgainstMax),
        rng,
        noDg
      );
      isThrashing = pointsFor >= 40 && pointsAgainst <= 12;
      break;
    case "high":
      if (won) {
        pointsFor = pickTeamScore(
          profile.winForMin + 6,
          profile.winForMax,
          rng,
          noDg
        );
        pointsAgainst = pickTeamScore(
          profile.winAgainstMin,
          Math.round(profile.winAgainstMax * oppFactor),
          rng,
          noDg
        );
      } else {
        pointsFor = pickTeamScore(
          profile.lossForMin,
          profile.lossForMax,
          rng,
          noDg
        );
        pointsAgainst = pickTeamScore(
          profile.lossAgainstMin,
          profile.lossAgainstMax,
          rng,
          noDg
        );
      }
      break;
    case "low":
      if (won) {
        pointsFor = pickTeamScore(
          Math.max(profile.winForMin - 4, 6),
          profile.winForMin + 4,
          rng,
          dgContext
        );
        pointsAgainst = pickTeamScore(
          profile.winAgainstMin,
          profile.winAgainstMax,
          rng,
          dgContext
        );
      } else {
        pointsFor = pickTeamScore(
          profile.lossForMin,
          profile.lossForMin + 8,
          rng,
          dgContext
        );
        pointsAgainst = pickTeamScore(
          profile.lossAgainstMin,
          profile.lossAgainstMax,
          rng,
          dgContext
        );
      }
      break;
    case "upset_loss":
      pointsFor = pickTeamScore(
        profile.lossForMin,
        profile.lossForMax,
        rng,
        dgContext
      );
      pointsAgainst = pickTeamScore(
        Math.max(profile.lossAgainstMin, 18),
        profile.lossAgainstMax,
        rng,
        dgContext
      );
      break;
    case "upset_win":
      pointsFor = pickTeamScore(
        profile.winForMin,
        profile.winForMin + 10,
        rng,
        dgContext
      );
      pointsAgainst = pickTeamScore(
        profile.winAgainstMin + 6,
        profile.winAgainstMax + 4,
        rng,
        dgContext
      );
      break;
    case "grinding":
      if (won) {
        pointsFor = pickTeamScore(
          profile.winForMin,
          profile.winForMin + 10,
          rng,
          dgContext
        );
        pointsAgainst = pickTeamScore(
          profile.winAgainstMin + 4,
          profile.winAgainstMax,
          rng,
          dgContext
        );
      } else {
        pointsFor = pickTeamScore(
          profile.lossForMin,
          profile.lossForMax,
          rng,
          dgContext
        );
        pointsAgainst = pickTeamScore(
          profile.lossAgainstMin,
          profile.lossAgainstMin + 10,
          rng,
          dgContext
        );
      }
      break;
    default:
      if (won) {
        pointsFor = pickTeamScore(
          profile.winForMin,
          profile.winForMax,
          rng,
          noDg
        );
        pointsAgainst = pickTeamScore(
          profile.winAgainstMin,
          Math.round(profile.winAgainstMax * oppFactor),
          rng,
          noDg
        );
      } else {
        pointsFor = pickTeamScore(
          profile.lossForMin,
          profile.lossForMax,
          rng,
          noDg
        );
        pointsAgainst = pickTeamScore(
          Math.round(profile.lossAgainstMin * oppFactor),
          profile.lossAgainstMax,
          rng,
          noDg
        );
      }
  }

  const formModifier = getFormScoringModifier(form, won);
  const adjustedFor = snapToRLScore(
    Math.round(pointsFor * formModifier),
    allowDg
  );

  const decisive = ensureDecisive(
    adjustedFor,
    pointsAgainst,
    won,
    allowDg
  );
  if (
    won &&
    decisive.pointsFor >= 40 &&
    decisive.pointsAgainst <= 12 &&
    decisive.pointsFor - decisive.pointsAgainst >= 24
  ) {
    isThrashing = true;
  }

  const dropGoalsInMatch =
    (scoreHasDropGoal(decisive.pointsFor) ? 1 : 0) +
    (scoreHasDropGoal(decisive.pointsAgainst) ? 1 : 0);

  const scoringFor = decomposeRLScore(decisive.pointsFor);
  const scoringAgainst = decomposeRLScore(decisive.pointsAgainst);

  return {
    ...decisive,
    triesFor: scoringFor.tries,
    triesAgainst: scoringAgainst.tries,
    scoringFor,
    scoringAgainst,
    isThrashing,
    dropGoalsInMatch,
  };
}

function resolveOutcome(
  strength: number,
  opponentStrength: number,
  form: number,
  isHome: boolean,
  rng: () => number
): { won: boolean; isUpset: boolean } {
  const homeAdvantage = isHome ? 2.5 : -2.5;
  const noise = (rng() - 0.5) * (strength >= 85 ? 10 : 14);
  const diff = strength - opponentStrength + homeAdvantage + form + noise;
  const logisticDivisor = strength >= 88 ? 5 : strength >= 72 ? 6 : 6.5;
  let winProbability = 1 / (1 + Math.exp(-diff / logisticDivisor));

  if (strength >= 92) {
    winProbability = Math.min(0.97, winProbability * 1.12);
  } else if (strength >= 85) {
    winProbability = Math.min(0.93, winProbability * 1.06);
  }

  let won = rng() < winProbability;
  let isUpset = false;

  const tier = getSquadTier(strength);

  // Upsets are possible but uncommon — elite squads can still go unbeaten
  if (won && tier === "elite" && opponentStrength < strength - 6) {
    const upsetChance =
      strength >= 93 ? 0.02 : strength >= 88 ? 0.04 : 0.07;
    if (rng() < upsetChance) {
      won = false;
      isUpset = true;
    }
  } else if (won && tier === "average" && opponentStrength > strength + 6) {
    if (rng() < 0.1) {
      won = false;
      isUpset = true;
    }
  }

  // Weak squads can spring surprise wins
  if (!won && tier === "weak" && opponentStrength > strength + 4) {
    if (rng() < 0.14) {
      won = true;
      isUpset = true;
    }
  } else if (!won && tier === "average" && opponentStrength > strength + 12) {
    if (rng() < 0.08) {
      won = true;
      isUpset = true;
    }
  }

  return { won, isUpset };
}

interface ScheduledFixture {
  opponent: string;
  isHome: boolean;
}

function buildFixtureList(rng: () => number): ScheduledFixture[] {
  const opponents: string[] = [];
  while (opponents.length < SEASON_GAMES) {
    const shuffled = [...OPPONENT_CLUBS].sort(() => rng() - 0.5);
    for (const club of shuffled) {
      opponents.push(club);
      if (opponents.length >= SEASON_GAMES) break;
    }
  }

  const homeCount = Math.ceil(SEASON_GAMES / 2);
  const homeFlags = Array.from({ length: SEASON_GAMES }, (_, i) => i < homeCount);
  for (let i = homeFlags.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [homeFlags[i], homeFlags[j]] = [homeFlags[j], homeFlags[i]];
  }

  return opponents.slice(0, SEASON_GAMES).map((opponent, index) => ({
    opponent,
    isHome: homeFlags[index],
  }));
}

function deriveLeaguePosition(
  wins: number,
  pointsDifference: number
): number {
  if (wins === 27) return 1;
  if (wins >= 25) return pointsDifference > 200 ? 1 : 2;
  if (wins >= 22) return 3;
  if (wins >= 19) return 4;
  if (wins >= 16) return 6;
  if (wins >= 13) return 8;
  if (wins >= 10) return 10;
  if (wins >= 7) return 12;
  return 14;
}

function findLongestLosingStreak(
  fixtures: MatchFixture[]
): { length: number; startRound: number; endRound: number } | null {
  let best: { length: number; startRound: number; endRound: number } | null =
    null;
  let current = 0;
  let start = 1;

  fixtures.forEach((fixture) => {
    if (fixture.result === "L") {
      if (current === 0) start = fixture.round;
      current++;
      if (!best || current > best.length) {
        best = {
          length: current,
          startRound: start,
          endRound: fixture.round,
        };
      }
    } else {
      current = 0;
    }
  });

  return best;
}

function findLongestWinStreak(
  fixtures: MatchFixture[]
): { length: number; startRound: number; endRound: number } | null {
  let best: { length: number; startRound: number; endRound: number } | null =
    null;
  let current = 0;
  let start = 1;

  fixtures.forEach((fixture, index) => {
    if (fixture.result === "W") {
      if (current === 0) start = fixture.round;
      current++;
      if (!best || current > best.length) {
        best = {
          length: current,
          startRound: start,
          endRound: fixture.round,
        };
      }
    } else {
      current = 0;
    }
  });

  return best;
}

export function generateSeasonInsights(result: SeasonResult): string[] {
  const insights: string[] = [];
  const { fixtures, pointsFor, pointsAgainst } = result;

  const streak = findLongestWinStreak(fixtures);
  if (streak && streak.length >= 5) {
    insights.push(
      `${DREAM_TEAM_NAME} won ${streak.length} straight matches between Rounds ${streak.startRound} and ${streak.endRound}.`
    );
  } else if (streak && streak.length >= 3) {
    insights.push(
      `A ${streak.length}-game winning run from Round ${streak.startRound} to ${streak.endRound} shaped the campaign.`
    );
  }

  const upsetLosses = fixtures.filter((f) => f.isUpset && f.result === "L");
  if (upsetLosses.length > 0) {
    const upset = upsetLosses[0];
    const priorWins = fixtures
      .filter((f) => f.round < upset.round && f.result === "W")
      .length;
    if (priorWins >= 3) {
      insights.push(
        `An upset defeat to ${upset.opponent} (${upset.pointsFor}-${upset.pointsAgainst}) ended momentum at Round ${upset.round}.`
      );
    } else {
      insights.push(
        `A surprise loss to ${upset.opponent} (${upset.pointsFor}-${upset.pointsAgainst}) at Round ${upset.round} stunned the league.`
      );
    }
  }

  const thrashings = fixtures.filter((f) => f.isThrashing && f.result === "W");
  if (thrashings.length > 0) {
    const best = thrashings.sort(
      (a, b) =>
        b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst)
    )[0];
    insights.push(
      `A ${best.pointsFor}-${best.pointsAgainst} demolition of ${best.opponent} was the season's biggest statement.`
    );
  }

  const upsetWins = fixtures.filter((f) => f.isUpset && f.result === "W");
  if (upsetWins.length > 0) {
    const win = upsetWins[0];
    insights.push(
      `A famous ${win.pointsFor}-${win.pointsAgainst} upset over ${win.opponent} at Round ${win.round} defied the odds.`
    );
  }

  insights.push(
    `The attack scored ${pointsFor} points during the campaign.`
  );
  insights.push(
    `The defence conceded ${pointsAgainst} points.`
  );

  if (result.isPerfect) {
    insights.unshift(
      `An unbeaten ${SEASON_GAMES}-game season — ${DREAM_TEAM_NAME} achieved the impossible 27-0.`
    );
  }

  return insights.slice(0, 6);
}

export interface MatchSimState {
  form: number;
  seasonDropGoals: number;
}

export function simulateOneFixture(
  squad: SquadSlot[],
  opponent: string,
  isHome: boolean,
  round: number,
  seed: string,
  state: MatchSimState
): { fixture: MatchFixture; state: MatchSimState } {
  const strength = calculateSquadStrength(squad);
  const rng = seedrandom(`${seed}-match-${round}`);

  const opponentStrength = getOpponentStrength(opponent, rng);
  const { won: initialWon, isUpset: initialUpset } = resolveOutcome(
    strength,
    opponentStrength,
    state.form,
    isHome,
    rng
  );

  const matchType = pickMatchType(
    strength,
    opponentStrength,
    initialWon,
    initialUpset,
    rng
  );

  const scoreline = generateScoreline(
    strength,
    opponentStrength,
    initialWon,
    matchType,
    rng,
    state.seasonDropGoals,
    state.form
  );

  let form = state.form;
  if (initialWon) {
    form = Math.min(10, form + 2);
  } else {
    form = Math.max(-10, form - 3);
  }

  const fixture: MatchFixture = {
    round,
    opponent,
    isHome,
    pointsFor: scoreline.pointsFor,
    pointsAgainst: scoreline.pointsAgainst,
    triesFor: scoreline.triesFor,
    triesAgainst: scoreline.triesAgainst,
    scoringFor: scoreline.scoringFor,
    scoringAgainst: scoreline.scoringAgainst,
    result: initialWon ? "W" : "L",
    isUpset: initialUpset,
    isThrashing: scoreline.isThrashing,
  };

  return {
    fixture,
    state: {
      form,
      seasonDropGoals: state.seasonDropGoals + scoreline.dropGoalsInMatch,
    },
  };
}

export function simulateSeason(
  squad: SquadSlot[],
  seed: string
): SeasonResult {
  const strength = calculateSquadStrength(squad);
  const rng = seedrandom(`${seed}-season`);

  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  let state: MatchSimState = { form: 0, seasonDropGoals: 0 };
  const gameResults: ("W" | "L")[] = [];
  const fixtures: MatchFixture[] = [];
  const opponents = buildFixtureList(rng);

  for (let i = 0; i < SEASON_GAMES; i++) {
    const { opponent, isHome } = opponents[i];
    const { fixture, state: nextState } = simulateOneFixture(
      squad,
      opponent,
      isHome,
      i + 1,
      seed,
      state
    );
    state = nextState;

    if (fixture.result === "W") {
      wins++;
      gameResults.push("W");
    } else {
      losses++;
      gameResults.push("L");
    }

    pointsFor += fixture.pointsFor;
    pointsAgainst += fixture.pointsAgainst;
    fixtures.push(fixture);
  }

  const pointsDifference = pointsFor - pointsAgainst;
  const tryScorers = distributeSeasonTries(squad, fixtures, seed, wins);

  const winStreak = findLongestWinStreak(fixtures);
  const lossStreak = findLongestLosingStreak(fixtures);

  const partialResult: SeasonResult = {
    wins,
    losses,
    pointsFor,
    pointsAgainst,
    pointsDifference,
    leaguePosition: deriveLeaguePosition(wins, pointsDifference),
    isPerfect: wins === 27,
    longestWinStreak: winStreak?.length ?? 0,
    longestLosingStreak: lossStreak?.length ?? 0,
    gameResults,
    fixtures,
    squadStrength: Math.round(strength * 10) / 10,
    tryScorers,
    insights: [],
  };

  partialResult.insights = generateSeasonInsights(partialResult);

  return partialResult;
}

function formatLeaguePositionLabel(position: number): string {
  const v = position % 100;
  const suffix =
    v >= 11 && v <= 13
      ? "th"
      : position % 10 === 1
        ? "st"
        : position % 10 === 2
          ? "nd"
          : position % 10 === 3
            ? "rd"
            : "th";
  return `${position}${suffix}`;
}

/** Season summary line — never repeats W-L record (shown separately). */
export function getSeasonSummaryMessage(
  leaguePosition: number,
  losses: number,
  wins = 27 - losses,
  grade = "C",
  result?: SeasonResult
): string {
  if (result) {
    return getSeasonCommentary(result, grade);
  }

  if (losses === 0) return "A flawless Super League campaign.";
  if (wins === 0) return "A campaign best left in the history books.";
  if (losses === 1) return "One defeat prevented perfection.";
  if (losses <= 3) return `${losses} defeats prevented perfection.`;

  const pos = formatLeaguePositionLabel(leaguePosition);
  if (leaguePosition === 1) return `Finished ${pos}. Elite campaign.`;
  if (leaguePosition <= 4)
    return `Finished ${pos}. A strong season, but not invincible.`;
  if (leaguePosition <= 8)
    return `Finished ${pos}. Solid Super League season.`;
  return `Finished ${pos}. Rebuild and go again.`;
}

/** @deprecated Use getSeasonSummaryMessage — kept to avoid record duplication. */
export function getNearMissMessage(
  _wins: number,
  losses: number,
  leaguePosition = 14
): string {
  return getSeasonSummaryMessage(leaguePosition, losses);
}

export function formatFixtureScore(fixture: MatchFixture): string {
  if (fixture.isHome) {
    return `${DREAM_TEAM_NAME} ${fixture.pointsFor} - ${fixture.pointsAgainst} ${fixture.opponent}`;
  }
  return `${fixture.opponent} ${fixture.pointsAgainst} - ${fixture.pointsFor} ${DREAM_TEAM_NAME}`;
}
