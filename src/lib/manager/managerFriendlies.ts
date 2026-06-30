import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { getManagerClubTeamRating } from "./managerRating";
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
      description: `A pre-season run-out against ${club}.`,
      attendanceInterest:
        teamRating >= 82 ? "high" : teamRating >= 74 ? "medium" : "low",
    };
  });

  const shuffled = [...pool].sort(() => rng() - 0.5);
  const unique: FriendlyOpponentChoice[] = [];
  const seen = new Set<string>();
  for (const c of shuffled) {
    if (seen.has(c.club)) continue;
    seen.add(c.club);
    unique.push(c);
    if (unique.length >= 12) break;
  }

  unique.sort((a, b) => a.teamRating - b.teamRating);
  if (unique.length < 3) return unique;

  const easy = unique[Math.floor(unique.length * 0.2)]!;
  const balanced = unique[Math.floor(unique.length * 0.5)]!;
  const hard = unique[Math.floor(unique.length * 0.85)]!;

  const describe = (
    c: FriendlyOpponentChoice,
    tier: "easy" | "balanced" | "hard"
  ) => {
    if (tier === "easy") {
      return `A useful warm-up against ${c.displayName}.`;
    }
    if (tier === "hard") {
      return `A tough test against ${c.displayName}.`;
    }
    return `A balanced pre-season run-out against ${c.displayName}.`;
  };

  return [
    { ...easy, difficulty: "easy", description: describe(easy, "easy") },
    {
      ...balanced,
      difficulty: "balanced",
      description: describe(balanced, "balanced"),
    },
    { ...hard, difficulty: "hard", description: describe(hard, "hard") },
  ];
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
  return {
    ...career,
    preSeason: {
      friendliesPlayed: played,
      awaitingChoice: played < 2,
      currentChoices: [],
      activeFriendly: null,
    },
  };
}

export function getFriendlyAttendanceInterest(
  choice: FriendlyOpponentChoice
): string {
  return ATTENDANCE_LABELS[choice.attendanceInterest];
}

export { defaultPreSeason };
