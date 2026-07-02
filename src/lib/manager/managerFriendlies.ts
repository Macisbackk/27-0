import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { getManagerClubTeamRating } from "./managerRating";
import { getHomeFixtureAttendanceOutlook, hasPoorAwayFollowing } from "./managerAttendance";
import type {
  FriendlyOpponentChoice,
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

function buildFriendlyCandidates(
  userClub: string,
  seed: string,
  friendlyIndex: number
): FriendlyOpponentChoice[] {
  const rng = seedrandom(`${seed}-friendly-${friendlyIndex}`);
  const pool: FriendlyOpponentChoice[] = CURRENT_PLAYABLE_CLUBS.filter(
    (club) => club !== userClub
  ).map((club) => {
    const teamRating = Math.round(getManagerClubTeamRating(club));
    return {
      id: `${club}-${CURRENT_SEASON}`,
      club,
      year: CURRENT_SEASON,
      displayName: club,
      difficulty: "balanced" as const,
      teamRating,
      attendanceInterest: attendanceInterestForFriendlyOpponent(club, teamRating),
    };
  });

  const shuffled = [...pool].sort(() => rng() - 0.5);
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
    career.preSeason.friendliesPlayed
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
      return `${outlook.label} (~${outlook.predictedAttendance.toLocaleString()})`;
    }
  }
  return ATTENDANCE_LABELS[choice.attendanceInterest];
}

function attendanceInterestForFriendlyOpponent(
  club: string,
  teamRating: number
): FriendlyOpponentChoice["attendanceInterest"] {
  if (hasPoorAwayFollowing(club)) {
    return teamRating >= 78 ? "medium" : "low";
  }
  if (teamRating >= 82) return "high";
  if (teamRating >= 74) return "medium";
  return "low";
}

export { defaultPreSeason };
