import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { getManagerClubTeamRating } from "./managerRating";
import {
  expectsLimitedCrossChannelFriendlyAwaySupport,
  getHomeFixtureAttendanceOutlook,
  hasPoorAwayFollowing,
} from "./managerAttendance";
import type {
  FriendlyOpponentChoice,
  InboxMessage,
  LatestNewsItem,
  ManagerCareer,
  PreSeasonState,
} from "./types";

const ATTENDANCE_LABELS = {
  low: "Modest crowd expected",
  medium: "Good pre-season interest",
  high: "Strong turnout expected",
} as const;

const CURRENT_SEASON = "2026";

function defaultPreSeason(): PreSeasonState {
  return {
    friendliesPlayed: 0,
    awaitingChoice: true,
    currentChoices: [],
    activeFriendly: null,
  };
}

export function initPreSeasonState(career: Partial<ManagerCareer>): PreSeasonState {
  if (career.preSeason) return career.preSeason;
  if ((career.fixtures?.length ?? 0) > 0 || (career.gameWeek ?? 0) > 0) {
    return {
      friendliesPlayed: 2,
      awaitingChoice: false,
      currentChoices: [],
      activeFriendly: null,
    };
  }
  return defaultPreSeason();
}

export function needsPreSeasonFriendlies(career: ManagerCareer): boolean {
  return career.preSeason.friendliesPlayed < 2;
}

export function isAwaitingFriendlyChoice(career: ManagerCareer): boolean {
  return (
    needsPreSeasonFriendlies(career) &&
    career.preSeason.awaitingChoice &&
    !career.preSeason.activeFriendly
  );
}

function previousFriendlyClubs(career: ManagerCareer): string[] {
  const clubs: string[] = [];
  for (const f of career.fixtures) {
    if (f.competition === "friendly" && f.opponent) {
      clubs.push(f.opponent);
    }
  }
  return clubs;
}

function buildFriendlyCandidates(
  userClub: string,
  seed: string,
  friendlyIndex: number,
  excludeClubs: string[] = []
): FriendlyOpponentChoice[] {
  const rng = seedrandom(`${seed}-friendly-${friendlyIndex}`);
  const exclude = new Set([userClub, ...excludeClubs]);
  const pool: FriendlyOpponentChoice[] = CURRENT_PLAYABLE_CLUBS.filter(
    (club) => !exclude.has(club)
  ).map((club) => {
    const teamRating = Math.round(getManagerClubTeamRating(club));
    return {
      id: `${club}-${CURRENT_SEASON}`,
      club,
      year: CURRENT_SEASON,
      displayName: club,
      difficulty: "balanced" as const,
      teamRating,
      attendanceInterest: attendanceInterestForFriendlyOpponent(
        userClub,
        club,
        teamRating
      ),
    };
  });

  // Fallback if exclusions emptied the pool (still never include user club).
  const usable =
    pool.length > 0
      ? pool
      : CURRENT_PLAYABLE_CLUBS.filter((club) => club !== userClub).map(
          (club) => {
            const teamRating = Math.round(getManagerClubTeamRating(club));
            return {
              id: `${club}-${CURRENT_SEASON}`,
              club,
              year: CURRENT_SEASON,
              displayName: club,
              difficulty: "balanced" as const,
              teamRating,
              attendanceInterest: attendanceInterestForFriendlyOpponent(
                userClub,
                club,
                teamRating
              ),
            };
          }
        );

  const shuffled = [...usable].sort(() => rng() - 0.5);
  return shuffled.slice(0, 3);
}

export function ensureFriendlyChoices(career: ManagerCareer): ManagerCareer {
  if (!needsPreSeasonFriendlies(career)) return career;
  if (!career.preSeason.awaitingChoice || career.preSeason.activeFriendly) {
    return career;
  }
  if (career.preSeason.currentChoices.length >= 3) return career;

  const choices = buildFriendlyCandidates(
    career.club,
    career.seed,
    career.preSeason.friendliesPlayed,
    previousFriendlyClubs(career)
  );

  return {
    ...career,
    preSeason: {
      ...career.preSeason,
      currentChoices: choices,
      awaitingChoice: choices.length > 0,
    },
  };
}

export function selectFriendlyOpponent(
  career: ManagerCareer,
  choiceId: string
): ManagerCareer {
  const choice = career.preSeason.currentChoices.find((c) => c.id === choiceId);
  if (!choice) return career;

  const rng = seedrandom(
    `${career.seed}-friendly-home-${career.preSeason.friendliesPlayed}`
  );
  const isHome = rng() > 0.35;

  return {
    ...career,
    preSeason: {
      ...career.preSeason,
      awaitingChoice: false,
      currentChoices: [],
      activeFriendly: {
        displayName: choice.club,
        club: choice.club,
        year: choice.year,
        teamRating: choice.teamRating,
        isHome,
        friendlyIndex: career.preSeason.friendliesPlayed,
      },
    },
  };
}

/**
 * For Sim to Date: if a friendly opponent is still required, pick one with the
 * seeded RNG, persist it, and continue — never overwrite a manual choice.
 */
export function autoSelectFriendlyForSim(career: ManagerCareer): {
  career: ManagerCareer;
  autoSelectedClub: string | null;
} {
  if (!isAwaitingFriendlyChoice(career)) {
    return { career, autoSelectedClub: null };
  }
  if (career.preSeason.activeFriendly) {
    return { career, autoSelectedClub: null };
  }

  let next = ensureFriendlyChoices(career);
  const choices = next.preSeason.currentChoices;
  if (choices.length === 0) {
    return { career: next, autoSelectedClub: null };
  }

  const rng = seedrandom(
    `${next.seed}-friendly-auto-${next.preSeason.friendliesPlayed}`
  );
  const pick = choices[Math.floor(rng() * choices.length)]!;
  next = selectFriendlyOpponent(next, pick.id);

  const note = `A friendly against ${pick.club} was arranged automatically.`;
  const newsItem: LatestNewsItem = {
    id: `news-friendly-auto-${next.seasonYear}-${next.preSeason.activeFriendly?.friendlyIndex ?? 0}`,
    week: next.gameWeek,
    type: "fixture",
    text: note,
  };
  const inbox: InboxMessage = {
    id: `inbox-friendly-auto-${next.seasonYear}-${next.preSeason.activeFriendly?.friendlyIndex ?? 0}`,
    type: "fixture",
    title: "Friendly arranged",
    body: note,
    week: next.gameWeek,
    season: next.seasonYear,
    gameWeek: next.gameWeek,
    createdAt: new Date(0).toISOString(),
    read: false,
  };

  // Stable IDs so replaying the same sim path does not duplicate notes.
  const existingNews = (next.latestNews ?? []).some((n) => n.id === newsItem.id);
  const existingInbox = (next.inboxMessages ?? []).some((m) => m.id === inbox.id);

  return {
    career: {
      ...next,
      latestNews: existingNews
        ? next.latestNews
        : [newsItem, ...(next.latestNews ?? [])].slice(0, 24),
      inboxMessages: existingInbox
        ? next.inboxMessages
        : [inbox, ...(next.inboxMessages ?? [])].slice(0, 80),
    },
    autoSelectedClub: pick.club,
  };
}

export function completeFriendlyMatch(career: ManagerCareer): ManagerCareer {
  const played = career.preSeason.friendliesPlayed + 1;
  return ensureFriendlyChoices({
    ...career,
    preSeason: {
      friendliesPlayed: played,
      awaitingChoice: played < 2,
      currentChoices: [],
      activeFriendly: null,
    },
  });
}

export function getFriendlyAttendanceInterest(
  choice: FriendlyOpponentChoice,
  career?: ManagerCareer
): string {
  if (career) {
    const outlook = getHomeFixtureAttendanceOutlook(career, {
      id: `friendly-preview-${choice.id}`,
      round: 0,
      opponent: choice.club,
      isHome: true,
      competition: "friendly",
    });
    if (outlook) {
      return `~${outlook.predictedAttendance.toLocaleString()} · ${outlook.label}`;
    }
  }
  return ATTENDANCE_LABELS[choice.attendanceInterest];
}

function attendanceInterestForFriendlyOpponent(
  userClub: string,
  opponentClub: string,
  teamRating: number
): FriendlyOpponentChoice["attendanceInterest"] {
  if (
    expectsLimitedCrossChannelFriendlyAwaySupport(
      userClub,
      opponentClub,
      "friendly"
    )
  ) {
    return "low";
  }
  if (hasPoorAwayFollowing(opponentClub)) {
    return teamRating >= 78 ? "medium" : "low";
  }
  if (teamRating >= 82) return "high";
  if (teamRating >= 74) return "medium";
  return "low";
}

export { defaultPreSeason };
