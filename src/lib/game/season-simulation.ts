import seedrandom from "seedrandom";
import { getPlayableClubNames } from "../clubs/super-league-display";
import { getMatchClubStrength } from "./opponent-squad-strength";
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
import {
  getBlowoutLossCap,
  getBlowoutWinRange,
} from "./score-gap";
import { getOpponentMatchRating } from "./opponent-scorers";
import { getSeasonCommentary } from "./season-commentary";
import type { ManOfTheMatch } from "./fantasy-match-summary";
import { getSeasonLeagueClubs } from "./league-replacement";
import { getDreamTeamTablePosition } from "./league-table";

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

type MatchType =
  | "low"
  | "normal"
  | "high"
  | "blowout"
  | "elite_blowout"
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
  isNeutral?: boolean;
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
  /** Short post-match summary (Fantasy Mode). */
  matchBio?: string;
  manOfTheMatch?: ManOfTheMatch;
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
  /** Real club replaced by Dream Team this season (not in fixtures/table). */
  replacedTeam: string;
  /** Super League play-offs after regular season (top six). */
  playoffResult?: import("./playoff-simulation").PlayoffResult;
}

const FORWARD_POSITIONS = new Set([
  "PROP",
  "HOOKER",
  "SECOND_ROW",
  "LOOSE_FORWARD",
]);

const OPPONENT_CLUBS = getPlayableClubNames();

function getOpponentStrength(
  opponent: string,
  seed: string,
  round: number,
  userIsHome: boolean
): number {
  return getMatchClubStrength(opponent, seed, round, !userIsHome);
}

export function calculateSquadStrength(squad: SquadSlot[]): number {
  const players = squad.filter((s) => s.player).map((s) => s.player!);
  if (players.length === 0) return 0;

  const avgRating = getAverageSquadRating(squad);
  const totalValue = getSquadValue(squad);
  const legendCount = players.filter((p) => p.category === "legend").length;
  const hasGoat = players.some(isGoatPlayer);

  const valueScore = Math.min(totalValue / 5_500_000, 1.35) * 38;
  const ratingScore = (avgRating / 95) * 45;
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
  ratingGap: number,
  won: boolean,
  isUpset: boolean,
  rng: () => number
): MatchType {
  if (isUpset) return won ? "upset_win" : "upset_loss";

  const margin = squadStrength - opponentStrength;
  const gap = Math.max(Math.abs(margin), Math.abs(ratingGap));

  if (won && gap >= 16 && rng() < 0.18) return "elite_blowout";
  if (won && gap >= 11 && rng() < 0.45) return "blowout";
  if (won && gap >= 8 && rng() < 0.38) return "high";
  if (won && gap >= 5 && rng() < 0.24) return "high";
  if (!won && gap <= -8 && rng() < 0.28) return "high";
  if (won && gap >= 3 && rng() < 0.12) return "low";
  if (rng() < 0.1) return "low";
  if (rng() < 0.14) return "grinding";
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
  ratingGap: number,
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
    case "elite_blowout": {
      const winRange = getBlowoutWinRange(
        ratingGap,
        profile.winForMin,
        profile.winForMax,
        rng
      );
      pointsFor = pickTeamScore(winRange.min, winRange.max, rng, noDg);
      pointsAgainst = pickTeamScore(
        0,
        getBlowoutLossCap(ratingGap, profile.winAgainstMax, rng),
        rng,
        noDg
      );
      isThrashing = pointsFor >= 50 && pointsAgainst <= 14;
      break;
    }
    case "blowout": {
      const winRange = getBlowoutWinRange(
        ratingGap,
        profile.winForMin,
        profile.winForMax,
        rng
      );
      pointsFor = pickTeamScore(
        winRange.min,
        Math.min(winRange.max, profile.winForMax + 10),
        rng,
        noDg
      );
      pointsAgainst = pickTeamScore(
        0,
        getBlowoutLossCap(ratingGap, profile.winAgainstMax, rng),
        rng,
        noDg
      );
      isThrashing = pointsFor >= 40 && pointsAgainst <= 12;
      break;
    }
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

export interface SimulateFixtureOptions {
  /** Slightly more upset variance in knockout cup ties. */
  cupMode?: boolean;
  /** Use opponent squad average rating instead of club base strength. */
  opponentRatingOverride?: number;
  /** Draft Mode — stronger teams rewarded, fewer unrealistic upsets. */
  draftMode?: boolean;
}

export interface SimulateSeasonOptions {
  draftMode?: boolean;
}

export interface ScheduledFixture {
  opponent: string;
  isHome: boolean;
}

function getValueConsistencyBonus(totalValue: number, draftMode: boolean): number {
  if (totalValue >= 8_000_000) return draftMode ? 8 : 7;
  if (totalValue >= 6_500_000) return draftMode ? 6.5 : 5.5;
  if (totalValue >= 5_000_000) return draftMode ? 5 : 4;
  if (totalValue >= 3_500_000) return draftMode ? 3.5 : 2.5;
  if (totalValue >= 2_500_000) return draftMode ? 2 : 1.2;
  return 0;
}

function getDraftTeamRatingBonus(avgRating: number): number {
  if (avgRating >= 92) return 3.5;
  if (avgRating >= 90) return 2.5;
  if (avgRating >= 88) return 1.5;
  if (avgRating >= 85) return 0.5;
  return 0;
}

function getDraftFavoriteUpsetChance(ratingGap: number, cupMode: boolean): number {
  if (ratingGap >= 10) return cupMode ? 0.008 : 0.004;
  if (ratingGap >= 7) return cupMode ? 0.015 : 0.01;
  if (ratingGap >= 4) return cupMode ? 0.03 : 0.022;
  if (ratingGap >= 2) return cupMode ? 0.05 : 0.038;
  return cupMode ? 0.08 : 0.06;
}

function getDraftWinProbabilityFloor(ratingGap: number): number | null {
  if (ratingGap >= 10) return 0.94;
  if (ratingGap >= 7) return 0.88;
  if (ratingGap >= 4) return 0.8;
  if (ratingGap >= 2) return 0.68;
  return null;
}

function getNormalWinProbabilityFloor(ratingGap: number): number | null {
  if (ratingGap >= 10) return 0.86;
  if (ratingGap >= 7) return 0.8;
  if (ratingGap >= 4) return 0.74;
  if (ratingGap >= 2) return 0.6;
  return null;
}

function resolveOutcome(
  squad: SquadSlot[],
  strength: number,
  opponentStrength: number,
  form: number,
  isHome: boolean,
  rng: () => number,
  options: SimulateFixtureOptions = {}
): { won: boolean; isUpset: boolean; ratingGap: number } {
  const avgRating = getAverageSquadRating(squad);
  const totalValue = getSquadValue(squad);
  const ratingGap = avgRating - opponentStrength;
  const draftMode = options.draftMode ?? false;
  const valueBonus = getValueConsistencyBonus(totalValue, draftMode);
  const cupMode = options.cupMode ?? false;

  const homeAdvantage = isHome ? 1.5 : -1;
  const formEffect = form * 0.4;
  const draftRatingBonus = draftMode ? getDraftTeamRatingBonus(avgRating) : 0;

  let noiseScale = draftMode ? 8 : 7;
  const absGap = Math.abs(ratingGap);
  if (absGap >= 10) noiseScale = draftMode ? 2 : 2.5;
  else if (absGap >= 8) noiseScale = draftMode ? 2.8 : 3.5;
  else if (absGap >= 7) noiseScale = draftMode ? 3.2 : 4;
  else if (absGap >= 5) noiseScale = draftMode ? 4 : 5;
  else if (absGap >= 4) noiseScale = draftMode ? 4.8 : 5.8;
  else if (absGap >= 3) noiseScale = draftMode ? 5.5 : 6.5;

  const noise = (rng() - 0.5) * noiseScale;
  const strengthGap = strength - opponentStrength;
  const ratingWeight = draftMode ? 1.55 : 1.28;
  const valueWeight = draftMode ? 0.85 : 0.75;
  const diff =
    ratingGap * ratingWeight +
    strengthGap * 0.35 +
    valueBonus * valueWeight +
    homeAdvantage +
    formEffect +
    draftRatingBonus +
    noise;

  const logisticDivisor = draftMode ? 3.9 : 4.2;
  let winProbability = 1 / (1 + Math.exp(-diff / logisticDivisor));

  if (draftMode) {
    const floor = getDraftWinProbabilityFloor(ratingGap);
    if (floor !== null) winProbability = Math.max(winProbability, floor);
    else if (ratingGap >= 5) winProbability = Math.max(winProbability, 0.74);
  } else {
    const floor = getNormalWinProbabilityFloor(ratingGap);
    if (floor !== null) winProbability = Math.max(winProbability, floor);
    else if (ratingGap >= 5) winProbability = Math.max(winProbability, 0.68);
  }

  if (ratingGap <= -10) winProbability = Math.min(winProbability, 0.1);
  else if (ratingGap <= -8) winProbability = Math.min(winProbability, 0.16);
  else if (ratingGap <= -5) winProbability = Math.min(winProbability, 0.26);

  winProbability = Math.max(0.04, Math.min(0.96, winProbability));

  if (!draftMode && ratingGap >= -4 && ratingGap <= 1) {
    winProbability = Math.min(0.96, winProbability + 0.05);
  }

  let won = rng() < winProbability;
  let isUpset = false;

  // Favourite losses — rare when rating gap is large
  if (won && ratingGap >= 2) {
    const upsetChance = draftMode
      ? getDraftFavoriteUpsetChance(ratingGap, cupMode)
      : ratingGap >= 10
        ? cupMode
          ? 0.035
          : 0.02
        : ratingGap >= 8
          ? cupMode
            ? 0.06
            : 0.04
          : ratingGap >= 5
            ? cupMode
              ? 0.1
              : 0.07
            : 0;
    if (upsetChance > 0 && rng() < upsetChance) {
      won = false;
      isUpset = true;
    }
  }

  // Underdog wins — only when Dream Team is weaker on paper
  if (!won && ratingGap <= -8) {
    const upsetChance = cupMode ? 0.14 : draftMode ? 0.08 : 0.09;
    if (rng() < upsetChance) {
      won = true;
      isUpset = true;
    }
  } else if (!won && ratingGap <= -5) {
    const upsetChance = cupMode ? 0.1 : draftMode ? 0.05 : 0.06;
    if (rng() < upsetChance) {
      won = true;
      isUpset = true;
    }
  }

  return { won, isUpset, ratingGap };
}

function buildFixtureList(
  rng: () => number,
  opponentClubs: string[]
): ScheduledFixture[] {
  const opponents: string[] = [];
  while (opponents.length < SEASON_GAMES) {
    const shuffled = [...opponentClubs].sort(() => rng() - 0.5);
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

/** Pre-built 27-round schedule for incremental fantasy season play. */
export function buildSeasonSchedule(seed: string): {
  schedule: ScheduledFixture[];
  opponentClubs: string[];
  replacedTeam: string;
} {
  const { opponentClubs, replacedTeam } = getSeasonLeagueClubs(seed);
  const rng = seedrandom(`${seed}-season`);
  return {
    schedule: buildFixtureList(rng, opponentClubs),
    opponentClubs,
    replacedTeam,
  };
}

/** @deprecated Wins-only estimate — use getDreamTeamTablePosition after simulation. */
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
  state: MatchSimState,
  options: SimulateFixtureOptions = {}
): { fixture: MatchFixture; state: MatchSimState } {
  const strength = calculateSquadStrength(squad);
  const rng = seedrandom(`${seed}-match-${round}`);

  const opponentStrength =
    options.opponentRatingOverride ??
    getOpponentStrength(opponent, seed, round, isHome);
  const { won: initialWon, isUpset: initialUpset, ratingGap } = resolveOutcome(
    squad,
    strength,
    opponentStrength,
    state.form,
    isHome,
    rng,
    options
  );

  const matchType = pickMatchType(
    strength,
    opponentStrength,
    ratingGap,
    initialWon,
    initialUpset,
    rng
  );

  const scoreline = generateScoreline(
    strength,
    opponentStrength,
    initialWon,
    matchType,
    ratingGap,
    rng,
    state.seasonDropGoals,
    state.form
  );

  let form = state.form;
  if (initialWon) {
    form = Math.min(10, form + 2);
  } else {
    form = Math.max(-10, form - 2);
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
  seed: string,
  options: SimulateSeasonOptions = {}
): SeasonResult {
  const strength = calculateSquadStrength(squad);
  const { schedule: opponents, replacedTeam } = buildSeasonSchedule(seed);
  const draftMode = options.draftMode ?? false;
  const fixtureOptions: SimulateFixtureOptions = draftMode ? { draftMode: true } : {};

  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  let state: MatchSimState = { form: 0, seasonDropGoals: 0 };
  const gameResults: ("W" | "L")[] = [];
  const fixtures: MatchFixture[] = [];

  for (let i = 0; i < SEASON_GAMES; i++) {
    const { opponent, isHome } = opponents[i];
    const round = i + 1;
    const simOptions: SimulateFixtureOptions = draftMode
      ? {
          ...fixtureOptions,
          opponentRatingOverride: getOpponentMatchRating(
            opponent,
            seed,
            round,
            { draftMode: true }
          ),
        }
      : fixtureOptions;

    const { fixture, state: nextState } = simulateOneFixture(
      squad,
      opponent,
      isHome,
      round,
      seed,
      state,
      simOptions
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
    replacedTeam,
  };

  partialResult.insights = generateSeasonInsights(partialResult);
  partialResult.leaguePosition = getDreamTeamTablePosition(partialResult, seed);

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
