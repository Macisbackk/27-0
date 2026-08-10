import type {
  ClubFacilities,
  ManagerCareer,
  ManagerSeasonSummary,
} from "./types";
import {
  CHAMPIONSHIP_EXPECTATION_LABELS,
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
import {
  getUserCompetitionId,
  getUserLeagueClubs,
  isUserInChampionship,
} from "./leagueMembership";

const PRESTIGE_SHIFT_THRESHOLD = 2;

function leagueSize(career?: ManagerCareer): number {
  return career ? getUserLeagueClubs(career).length : CURRENT_PLAYABLE_CLUBS.length;
}

function clampStarsForCompetition(
  stars: number,
  competition: "super-league" | "championship"
): number {
  const max = competition === "championship" ? 3 : 5;
  return Math.max(1, Math.min(max, Math.round(stars)));
}

/**
 * Ensure SL and Championship prestige tracks exist, and sync `difficulty`
 * to the active competition's track.
 */
export function ensureLeagueStarTracks(career: ManagerCareer): ManagerCareer {
  const config = getManagerClubConfig(career.club);
  const competition = getUserCompetitionId(career);
  const fallback = config.difficulty;
  const active =
    career.difficulty ??
    (competition === "championship"
      ? Math.min(3, fallback)
      : Math.min(5, fallback));

  let superLeagueDifficulty = career.superLeagueDifficulty;
  let championshipDifficulty = career.championshipDifficulty;

  if (superLeagueDifficulty == null) {
    superLeagueDifficulty =
      competition === "super-league"
        ? clampStarsForCompetition(active, "super-league")
        : 1;
  } else {
    superLeagueDifficulty = clampStarsForCompetition(
      superLeagueDifficulty,
      "super-league"
    );
  }

  if (championshipDifficulty == null) {
    championshipDifficulty =
      competition === "championship"
        ? clampStarsForCompetition(active, "championship")
        : clampStarsForCompetition(
            config.competition === "championship" ? fallback : 2,
            "championship"
          );
  } else {
    championshipDifficulty = clampStarsForCompetition(
      championshipDifficulty,
      "championship"
    );
  }

  const difficulty =
    competition === "championship"
      ? championshipDifficulty
      : superLeagueDifficulty;

  if (
    career.superLeagueDifficulty === superLeagueDifficulty &&
    career.championshipDifficulty === championshipDifficulty &&
    career.difficulty === difficulty
  ) {
    return career;
  }

  return {
    ...career,
    superLeagueDifficulty,
    championshipDifficulty,
    difficulty,
  };
}

export function getCareerClubStars(career: ManagerCareer): number {
  const tracked = ensureLeagueStarTracks(career);
  return getUserCompetitionId(tracked) === "championship"
    ? (tracked.championshipDifficulty as number)
    : (tracked.superLeagueDifficulty as number);
}

/** Write stars onto the active competition track and sync `difficulty`. */
export function withCareerClubStars(
  career: ManagerCareer,
  stars: number
): ManagerCareer {
  const tracked = ensureLeagueStarTracks(career);
  const competition = getUserCompetitionId(tracked);
  const clamped = clampStarsForCompetition(stars, competition);
  if (competition === "championship") {
    return {
      ...tracked,
      championshipDifficulty: clamped,
      difficulty: clamped,
    };
  }
  return {
    ...tracked,
    superLeagueDifficulty: clamped,
    difficulty: clamped,
  };
}

/**
 * On promotion: keep Champ track; restore stored Super League stars
 * (1★ on first promotion, prior SL rating when returning after relegation).
 * On relegation: keep SL track; switch to stored Champ track.
 */
export function applyPromotionRelegationStarTracks(
  career: ManagerCareer,
  options: { userPromoted: boolean; userRelegated: boolean }
): ManagerCareer {
  let next = ensureLeagueStarTracks(career);

  if (options.userPromoted) {
    const champStars = clampStarsForCompetition(
      next.championshipDifficulty ?? next.difficulty,
      "championship"
    );
    // Returning clubs keep earned SL prestige; first-time promote is 1★.
    const slStars = clampStarsForCompetition(
      next.superLeagueDifficulty ?? 1,
      "super-league"
    );
    const firstPromotion = slStars <= 1;
    const tier = expectationTierFromStars(slStars, "super-league");
    next = {
      ...next,
      userCompetitionId: "super-league",
      championshipDifficulty: champStars,
      superLeagueDifficulty: slStars,
      difficulty: slStars,
      prestigeMomentum: 0,
      clubStarRiseCelebratedAt: slStars,
      pendingClubStarRiseFrom: undefined,
      boardExpectation: MANAGER_EXPECTATION_LABELS[tier],
    };
    next = pushInboxMessage(next, {
      id: `user-promoted-stars-${next.seasonYear}`,
      type: "board",
      title: "Super League club rating",
      body: firstPromotion
        ? `${next.club}: Super League 1★ (Champ ${champStars}★ kept). SL market unlocked.`
        : `${next.club}: Super League ${slStars}★ restored (Champ ${champStars}★ kept).`,
      week: next.gameWeek,
      season: next.seasonYear,
      gameWeek: next.gameWeek,
      createdAt: new Date().toISOString(),
      read: false,
      sender: "Board",
    });
    return next;
  }

  if (options.userRelegated) {
    const slStars = clampStarsForCompetition(
      next.superLeagueDifficulty ?? next.difficulty,
      "super-league"
    );
    const champStars = clampStarsForCompetition(
      next.championshipDifficulty ??
        getManagerClubConfig(next.club).difficulty,
      "championship"
    );
    const tier = expectationTierFromStars(champStars, "championship");
    next = {
      ...next,
      userCompetitionId: "championship",
      superLeagueDifficulty: slStars,
      championshipDifficulty: champStars,
      difficulty: champStars,
      prestigeMomentum: 0,
      clubStarRiseCelebratedAt: champStars,
      pendingClubStarRiseFrom: undefined,
      boardExpectation: CHAMPIONSHIP_EXPECTATION_LABELS[tier],
    };
    next = pushInboxMessage(next, {
      id: `user-relegated-stars-${next.seasonYear}`,
      type: "board",
      title: "Championship club rating",
      body: `${next.club}: Championship ${champStars}★ (SL ${slStars}★ kept).`,
      week: next.gameWeek,
      season: next.seasonYear,
      gameWeek: next.gameWeek,
      createdAt: new Date().toISOString(),
      read: false,
      sender: "Board",
    });
  }

  return next;
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
  const league =
    career.userCompetitionId === "championship"
      ? "championship"
      : "super-league";
  return expectationTierFromStars(getCareerClubStars(career), league);
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
  const met = didMeetManagerBoardExpectation(
    tier,
    position,
    playoffFinish,
    getUserCompetitionId(career)
  );
  const wonTitle =
    playoffFinish === "Super League Champions" ||
    (isUserInChampionship(career) && position === 1);
  const wonCup = summary.trophies.some((t) => t.includes("Challenge Cup"));

  if (wonTitle && tier !== "title") return 1;
  if (wonCup && met) return 1;
  if (met && position <= 2 && (tier === "top" || tier === "playoffs" || tier === "mid-table")) {
    return 1;
  }
  if (met) return 0;

  if (position >= leagueSize(career) - 1) return -1;
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
  options?: {
    seasonStartFacilities?: ClubFacilities;
    /** League the completed season was played in (before prom/rel). */
    seasonCompetition?: "super-league" | "championship";
  }
): { career: ManagerCareer; starDelta: number } {
  career = ensureLeagueStarTracks(career);
  const seasonStartFacilities =
    options?.seasonStartFacilities ?? getClubFacilities(career);
  const delta =
    evaluateSeasonPrestigeMomentumDelta(career, summary) +
    evaluateSquadGrowthMomentum(career) +
    evaluateFacilityInvestmentMomentum(
      seasonStartFacilities,
      getClubFacilities(career)
    );
  const league =
    options?.seasonCompetition ??
    (isUserInChampionship(career) ? "championship" : "super-league");
  const inChampionship = league === "championship";
  const maxStars = inChampionship ? 3 : 5;
  let momentum = (career.prestigeMomentum ?? 0) + delta;
  // Drift the track for the season just played — not the post-prom/rel league.
  let stars = inChampionship
    ? (career.championshipDifficulty as number)
    : (career.superLeagueDifficulty as number);
  let starDelta = 0;

  while (momentum >= PRESTIGE_SHIFT_THRESHOLD && stars < maxStars) {
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

  const tier = expectationTierFromStars(stars, league);
  const activeCompetition = getUserCompetitionId(career);
  const boardExpectation =
    activeCompetition === "championship"
      ? CHAMPIONSHIP_EXPECTATION_LABELS[
          expectationTierFromStars(
            career.championshipDifficulty ?? stars,
            "championship"
          )
        ]
      : MANAGER_EXPECTATION_LABELS[
          expectationTierFromStars(
            career.superLeagueDifficulty ?? stars,
            "super-league"
          )
        ];

  // Update the completed season's track; keep active difficulty synced.
  let next: ManagerCareer = {
    ...career,
    prestigeMomentum: momentum,
    ...(inChampionship
      ? { championshipDifficulty: stars }
      : { superLeagueDifficulty: stars }),
  };
  next = {
    ...next,
    difficulty:
      activeCompetition === "championship"
        ? (next.championshipDifficulty as number)
        : (next.superLeagueDifficulty as number),
    // Only rewrite board target from drift when still in the same league.
    boardExpectation:
      activeCompetition === league
        ? inChampionship
          ? CHAMPIONSHIP_EXPECTATION_LABELS[tier]
          : MANAGER_EXPECTATION_LABELS[tier]
        : boardExpectation,
    ...(starDelta > 0 && activeCompetition === league
      ? {
          pendingClubStarRiseFrom: Math.max(
            1,
            stars - starDelta
          ),
        }
      : {}),
  };

  if (starDelta !== 0) {
    const nextSeason = career.seasonYear + 1;
    const trackLabel = inChampionship ? "Championship" : "Super League";
    const msgId = `prestige-${starDelta > 0 ? "rise" : "fall"}-${league}-s${nextSeason}`;
    if (!next.inboxMessages.some((m) => m.id === msgId)) {
      next = pushInboxMessage(next, {
        id: msgId,
        eventId: msgId,
        type: "board",
        sender: "Board",
        title:
          starDelta > 0
            ? `${trackLabel} status rising`
            : `${trackLabel} status falling`,
        body:
          starDelta > 0
            ? `${career.club} ${trackLabel} now ${stars}★.`
            : `${career.club} ${trackLabel} now ${stars}★.`,
        week: 0,
        season: nextSeason,
        gameWeek: 0,
        createdAt: new Date().toISOString(),
        read: false,
        resolved: false,
        deadlineLabel: `Season ${nextSeason}`,
        requiredAction:
          starDelta > 0 ? "Hit the new target" : "Stabilise results",
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
  // Once per season — weekly ultimatums repeated the same warning.
  const msgId = `board-ultimatum-s${career.seasonYear}`;
  if (
    career.inboxMessages.some(
      (m) =>
        m.id === msgId ||
        m.eventId === msgId ||
        (typeof m.id === "string" &&
          m.id.startsWith(`board-ultimatum-s${career.seasonYear}`))
    )
  ) {
    return career;
  }

  return pushInboxMessage(career, {
    id: msgId,
    eventId: msgId,
    type: "board",
    sender: "Board",
    title: "Board ultimatum",
    body: `Confidence ${career.boardConfidence}%. Need ${career.boardExpectation} or face the sack.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    deadlineLabel: "Immediate",
    requiredAction: "Win matches and restore board confidence",
  });
}
