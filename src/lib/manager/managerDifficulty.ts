import type {
  ClubFacilities,
  ManagerCareer,
  ManagerSeasonSummary,
} from "./types";
import {
  didMeetManagerBoardExpectation,
  expectationTierFromStars,
  getManagerClubConfig,
  MANAGER_EXPECTATION_LABELS,
  type ManagerClubExpectationTier,
} from "./club-config";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { getUserLeaguePosition } from "./managerFixtures";
import { getClubFacilities } from "./managerFacilities";
import { pushInboxMessage } from "./managerInbox";

const PRESTIGE_SHIFT_THRESHOLD = 2;
const LEAGUE_SIZE = CURRENT_PLAYABLE_CLUBS.length;

export function getCareerClubStars(career: ManagerCareer): number {
  return career.difficulty ?? getManagerClubConfig(career.club).difficulty;
}

export function shouldShowClubStarRiseCelebration(
  career: ManagerCareer
): boolean {
  const stars = getCareerClubStars(career);
  const celebratedAt =
    career.clubStarRiseCelebratedAt ??
    getManagerClubConfig(career.club).difficulty;
  return stars > celebratedAt;
}

export function getPendingClubStarRiseFrom(career: ManagerCareer): number {
  if (career.pendingClubStarRiseFrom != null) {
    return career.pendingClubStarRiseFrom;
  }
  return Math.max(1, getCareerClubStars(career) - 1);
}

export function acknowledgeClubStarRiseCelebration(
  career: ManagerCareer
): ManagerCareer {
  return {
    ...career,
    clubStarRiseCelebratedAt: getCareerClubStars(career),
    pendingClubStarRiseFrom: undefined,
  };
}

/** +1 momentum when the squad improved meaningfully over the season. */
export function evaluateSquadGrowthMomentum(career: ManagerCareer): number {
  const dev = career.playerDevelopment ?? {};
  let totalStart = 0;
  let totalNow = 0;
  let count = 0;

  for (const ps of career.squad) {
    const state = dev[ps.playerId];
    const seasonStart = state?.seasonStartRating;
    if (seasonStart == null) continue;
    totalStart += seasonStart;
    totalNow += state.rating ?? seasonStart;
    count += 1;
  }

  if (count === 0) return 0;
  return (totalNow - totalStart) / count >= 2 ? 1 : 0;
}

/** +1 momentum when facilities were upgraded during the season. */
export function evaluateFacilityInvestmentMomentum(
  seasonStart: ClubFacilities,
  current: ClubFacilities
): number {
  const startTotal = Object.values(seasonStart).reduce((sum, level) => sum + level, 0);
  const currentTotal = Object.values(current).reduce((sum, level) => sum + level, 0);
  return currentTotal - startTotal >= 3 ? 1 : 0;
}

export function getCareerExpectationTier(
  career: ManagerCareer
): ManagerClubExpectationTier {
  return expectationTierFromStars(getCareerClubStars(career));
}

export interface ManagerDifficultySimAdjustments {
  opponentRatingDelta: number;
  formDelta: number;
}

export interface ManagerDifficultyPressure {
  label: string;
  detail: string;
  tone: "gold" | "primary" | "amber" | "red" | "muted";
}

function expectationTier(career: ManagerCareer): ManagerClubExpectationTier {
  return getCareerExpectationTier(career);
}

/** +1 / 0 / -1 momentum from one season vs the current board target. */
export function evaluateSeasonPrestigeMomentumDelta(
  career: ManagerCareer,
  summary: ManagerSeasonSummary
): number {
  const tier = getCareerExpectationTier(career);
  const position = summary.position;
  const playoffFinish = summary.playoffFinish ?? null;
  const met = didMeetManagerBoardExpectation(tier, position, playoffFinish);
  const wonTitle = playoffFinish === "Super League Champions";
  const wonCup = summary.trophies.some((t) => t.includes("Challenge Cup"));

  if (wonTitle && tier !== "title") return 1;
  if (wonCup && met) return 1;
  if (met && position <= 2 && (tier === "top" || tier === "playoffs" || tier === "mid-table")) {
    return 1;
  }
  if (met) return 0;

  if (position >= LEAGUE_SIZE - 1) return -1;
  if (tier === "title" && position > 6) return -1;
  if (tier === "top" && position > 6) return -1;
  if (tier === "playoffs" && position > 10) return -1;
  if (tier === "mid-table" && position >= 12) return -1;
  if ((tier === "survive" || tier === "avoid-bottom") && position >= 13) return -1;
  return -1;
}

export function applySeasonClubPrestigeDrift(
  career: ManagerCareer,
  summary: ManagerSeasonSummary,
  options?: { seasonStartFacilities?: ClubFacilities }
): { career: ManagerCareer; starDelta: number } {
  const seasonStartFacilities =
    options?.seasonStartFacilities ?? getClubFacilities(career);
  const delta =
    evaluateSeasonPrestigeMomentumDelta(career, summary) +
    evaluateSquadGrowthMomentum(career) +
    evaluateFacilityInvestmentMomentum(
      seasonStartFacilities,
      getClubFacilities(career)
    );
  let momentum = (career.prestigeMomentum ?? 0) + delta;
  let stars = getCareerClubStars(career);
  let starDelta = 0;

  while (momentum >= PRESTIGE_SHIFT_THRESHOLD && stars < 5) {
    stars += 1;
    starDelta += 1;
    momentum -= PRESTIGE_SHIFT_THRESHOLD;
  }
  while (momentum <= -PRESTIGE_SHIFT_THRESHOLD && stars > 1) {
    stars -= 1;
    starDelta -= 1;
    momentum += PRESTIGE_SHIFT_THRESHOLD;
  }

  momentum = Math.max(-1, Math.min(1, momentum));

  const tier = expectationTierFromStars(stars);
  let next: ManagerCareer = {
    ...career,
    difficulty: stars,
    prestigeMomentum: momentum,
    boardExpectation: MANAGER_EXPECTATION_LABELS[tier],
    ...(starDelta > 0
      ? { pendingClubStarRiseFrom: getCareerClubStars(career) }
      : {}),
  };

  if (starDelta !== 0) {
    const nextSeason = career.seasonYear + 1;
    const msgId = `prestige-${starDelta > 0 ? "rise" : "fall"}-s${nextSeason}`;
    if (!next.inboxMessages.some((m) => m.id === msgId)) {
      next = pushInboxMessage(next, {
        id: msgId,
        type: "news",
        title: starDelta > 0 ? "Club status rising" : "Club status falling",
        body:
          starDelta > 0
            ? `Years of success have raised ${career.club} to a ${stars}-star club. Board expectations will increase.`
            : `Persistent poor results have dropped ${career.club} to a ${stars}-star club.`,
        week: 0,
        season: nextSeason,
        gameWeek: 0,
        createdAt: new Date().toISOString(),
        read: false,
        resolved: true,
      });
    }
  }

  return { career: next, starDelta };
}

/** Nudge simulation from club strength tier and current league standing. */
export function getManagerDifficultySimAdjustments(
  career: ManagerCareer
): ManagerDifficultySimAdjustments {
  const tier = expectationTier(career);
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const week = Math.max(1, career.gameWeek);

  let opponentRatingDelta = 0;
  let formDelta = 0;

  if (tier === "survive" || tier === "avoid-bottom") {
    opponentRatingDelta += 1.2;
    formDelta -= 0.4;
  } else if (tier === "title" || tier === "top" || tier === "playoffs") {
    opponentRatingDelta -= 0.8;
    formDelta += 0.3;
  }

  if (week >= 10) {
    if (tier === "title" && position > 2) {
      opponentRatingDelta += 0.6;
      formDelta -= 0.25;
    }
    if (tier === "top" && position > 3) {
      opponentRatingDelta += 0.55;
      formDelta -= 0.22;
    }
    if (tier === "playoffs" && position > 6) {
      opponentRatingDelta += 0.5;
      formDelta -= 0.2;
    }
    if (tier === "mid-table" && position >= 11) {
      opponentRatingDelta += 0.35;
      formDelta -= 0.15;
    }
    if (tier === "survive" && position >= 10) {
      opponentRatingDelta += 1;
      formDelta -= 0.35;
    }
    // avoid-bottom only comes from squad-rank helpers, not star ratings
    if (tier === "avoid-bottom" && position >= 11) {
      opponentRatingDelta += 0.85;
      formDelta -= 0.3;
    }
  }

  if (career.boardConfidence < 35) {
    opponentRatingDelta += 0.4;
    formDelta -= 0.15;
  }

  if ((career.wagePressureWeeks ?? 0) >= 2) {
    formDelta -= 0.2;
  }

  return { opponentRatingDelta, formDelta };
}

/** Extra board confidence swing from expectation vs table position. */
export function getManagerDifficultyBoardDelta(
  career: ManagerCareer,
  position: number,
  won: boolean
): number {
  const tier = expectationTier(career);
  const week = Math.max(1, career.gameWeek);
  if (week < 6) return 0;

  let delta = 0;

  if (tier === "title") {
    if (position === 1 && won) delta += 1;
    if (position > 3 && !won) delta -= 2;
    if (position > 5 && won) delta -= 1;
  } else if (tier === "top") {
    if (position <= 3 && won) delta += 1;
    if (position > 5 && !won) delta -= 2;
    if (position > 6 && won) delta -= 1;
  } else if (tier === "playoffs") {
    if (position <= 6 && won) delta += 1;
    if (position > 8 && !won) delta -= 2;
  } else if (tier === "mid-table") {
    if (position <= 8 && won) delta += 1;
    if (position >= 11 && !won) delta -= 2;
    if (position >= 12 && !won) delta -= 1;
  } else if (tier === "survive" || tier === "avoid-bottom") {
    if (position <= 10 && won) delta += 2;
    if (position >= 12 && !won) delta -= 3;
    if (position >= 13 && !won) delta -= 2;
  }

  return delta;
}

export function getManagerDifficultyPressure(
  career: ManagerCareer
): ManagerDifficultyPressure {
  const tier = expectationTier(career);
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const target = MANAGER_EXPECTATION_LABELS[tier];
  const stars = getCareerClubStars(career);

  if (career.boardConfidence < 30) {
    return {
      label: "Board ultimatum",
      detail: `Confidence at ${career.boardConfidence}% — results must improve quickly.`,
      tone: "red",
    };
  }

  if ((career.wagePressureWeeks ?? 0) >= 3) {
    return {
      label: "Financial pressure",
      detail: `${career.wagePressureWeeks} weeks over the wage budget — the board are watching.`,
      tone: "amber",
    };
  }

  if (tier === "title" && position > 3 && career.gameWeek >= 8) {
    return {
      label: "Title pressure",
      detail: `Target: ${target} · Currently ${position}th — every point counts.`,
      tone: "amber",
    };
  }

  if (
    (tier === "survive" || tier === "avoid-bottom") &&
    position >= 11 &&
    career.gameWeek >= 8
  ) {
    return {
      label: "Relegation scrap",
      detail: `${position}th place with a ${target.toLowerCase()} brief — pick up points.`,
      tone: "red",
    };
  }

  if (tier === "top" && position > 3 && career.gameWeek >= 8) {
    return {
      label: "Top-three push",
      detail: `Target: ${target} · Currently ${position}th — stay in the leading pack.`,
      tone: "amber",
    };
  }

  if (tier === "playoffs" && position > 6 && career.gameWeek >= 10) {
    return {
      label: "Play-off push",
      detail: `${position}th — need top-six form to meet the ${target.toLowerCase()} target.`,
      tone: "primary",
    };
  }

  if (tier === "mid-table" && position >= 11 && career.gameWeek >= 8) {
    return {
      label: "Mid-table push",
      detail: `${position}th — need to climb the table to meet a ${target.toLowerCase()} target.`,
      tone: "amber",
    };
  }

  return {
    label: `${stars}-star club`,
    detail: `Board target: ${target} · Table: ${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"}`,
    tone: position <= 4 ? "gold" : position >= 11 ? "amber" : "muted",
  };
}

export function maybeAddBoardUltimatumInbox(
  career: ManagerCareer
): ManagerCareer {
  if (career.boardConfidence >= 30) return career;
  const msgId = `board-ultimatum-s${career.seasonYear}-w${career.gameWeek}`;
  if (career.inboxMessages.some((m) => m.id === msgId)) return career;

  return pushInboxMessage(career, {
    id: msgId,
    type: "news",
    title: "Board ultimatum",
    body: `The board's confidence has dropped to ${career.boardConfidence}%. ${career.boardExpectation} is the minimum standard — improve results or face consequences.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: true,
  });
}
