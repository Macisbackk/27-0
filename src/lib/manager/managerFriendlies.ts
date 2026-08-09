import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import {
  CHAMPIONSHIP_CLUB_NAMES,
  isChampionshipClubName,
} from "../clubs/championship-clubs";
import { getClubBaseStrength } from "../game/club-strength";
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
  ScheduledFriendly,
} from "./types";

export const FRIENDLIES_REQUIRED = 3;
/** v3: Championship friendly ratings use cup tier strength (not baseStrength×1.15). */
export const FRIENDLY_SCHEDULE_VERSION = 3;

const ATTENDANCE_LABELS = {
  low: "Modest crowd expected",
  medium: "Good pre-season interest",
  high: "Strong turnout expected",
} as const;

const CURRENT_SEASON = "2026";

function defaultPreSeason(): PreSeasonState {
  return {
    friendliesPlayed: 0,
    friendliesRequired: FRIENDLIES_REQUIRED,
    awaitingChoice: true,
    currentChoices: [],
    draftSchedule: [],
    confirmedSchedule: [],
    awaitingScheduleConfirm: false,
    friendlyScheduleVersion: FRIENDLY_SCHEDULE_VERSION,
    activeFriendly: null,
  };
}

function championshipFriendlyRating(club: string): number {
  // Same tier-offset scale as Challenge Cup / getClubBaseStrength (~40–62).
  // Previously used raw baseStrength×1.15 (~71–85), which made Championship
  // friendlies play like Super League peers against a full SL XIII.
  return getClubBaseStrength(club);
}

function withCorrectChampionshipFriendlyRating<
  T extends { club: string; teamRating: number },
>(item: T): T {
  if (!isChampionshipClubName(item.club)) return item;
  const teamRating = championshipFriendlyRating(item.club);
  return item.teamRating === teamRating ? item : { ...item, teamRating };
}

function remapChampionshipFriendlyRatings(
  state: PreSeasonState
): PreSeasonState {
  return {
    ...state,
    currentChoices: (state.currentChoices ?? []).map(
      withCorrectChampionshipFriendlyRating
    ),
    draftSchedule: (state.draftSchedule ?? []).map(
      withCorrectChampionshipFriendlyRating
    ),
    confirmedSchedule: (state.confirmedSchedule ?? []).map(
      withCorrectChampionshipFriendlyRating
    ),
    activeFriendly: state.activeFriendly
      ? withCorrectChampionshipFriendlyRating(state.activeFriendly)
      : null,
  };
}

function buildOpponentChoice(
  club: string,
  userClub: string,
  teamRating: number
): FriendlyOpponentChoice {
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

function buildFriendlyCandidates(
  userClub: string,
  seed: string,
  friendlyIndex: number,
  excludeClubs: string[] = []
): FriendlyOpponentChoice[] {
  const rng = seedrandom(`${seed}-friendly-${friendlyIndex}`);
  const exclude = new Set([userClub, ...excludeClubs]);

  const slPool = CURRENT_PLAYABLE_CLUBS.filter((club) => !exclude.has(club)).map(
    (club) =>
      buildOpponentChoice(
        club,
        userClub,
        Math.round(getManagerClubTeamRating(club))
      )
  );
  const champPool = CHAMPIONSHIP_CLUB_NAMES.filter(
    (club) => !exclude.has(club)
  ).map((club) =>
    buildOpponentChoice(club, userClub, championshipFriendlyRating(club))
  );

  const shuffledSl = [...slPool].sort(() => rng() - 0.5);
  const shuffledChamp = [...champPool].sort(() => rng() - 0.5);

  // Prefer a mix: usually 2 Super League + 1 Championship among the 3 choices.
  const picks: FriendlyOpponentChoice[] = [];
  if (shuffledChamp[0]) picks.push(shuffledChamp[0]);
  for (const c of shuffledSl) {
    if (picks.length >= 3) break;
    picks.push(c);
  }
  for (const c of shuffledChamp.slice(1)) {
    if (picks.length >= 3) break;
    if (!picks.some((p) => p.club === c.club)) picks.push(c);
  }

  if (picks.length >= 3) return picks.slice(0, 3);

  const fallback = [...shuffledSl, ...shuffledChamp].filter(
    (c) => !picks.some((p) => p.club === c.club)
  );
  return [...picks, ...fallback].slice(0, 3);
}

function normalizePreSeason(state: PreSeasonState): PreSeasonState {
  const required = state.friendliesRequired ?? FRIENDLIES_REQUIRED;
  return {
    ...state,
    friendliesRequired: required,
    draftSchedule: state.draftSchedule ?? [],
    confirmedSchedule: state.confirmedSchedule ?? [],
    awaitingScheduleConfirm: state.awaitingScheduleConfirm ?? false,
    // Keep missing version as 0 so migration can detect legacy saves.
    friendlyScheduleVersion: state.friendlyScheduleVersion ?? 0,
  };
}

/**
 * Pre-season is only playable while an opponent is active, a pick is pending or a
 * draft is awaiting confirmation. Any other unfinished state has no route forward
 * and would leave the calendar with no next fixture, so treat it as complete.
 */
function repairPreSeasonDeadEnd(state: PreSeasonState): PreSeasonState {
  const required = state.friendliesRequired ?? FRIENDLIES_REQUIRED;
  if (state.friendliesPlayed >= required) return state;
  if (state.activeFriendly) return state;
  if (state.awaitingChoice) return state;
  if (state.awaitingScheduleConfirm) return state;
  return {
    ...state,
    friendliesPlayed: required,
    currentChoices: [],
    activeFriendly: null,
  };
}

export function initPreSeasonState(career: Partial<ManagerCareer>): PreSeasonState {
  if (career.preSeason) {
    const rawVersion = career.preSeason.friendlyScheduleVersion ?? 0;
    const normalized = remapChampionshipFriendlyRatings(
      normalizePreSeason(career.preSeason)
    );
    if (rawVersion < FRIENDLY_SCHEDULE_VERSION) {
      const played = normalized.friendliesPlayed;
      const legacyRequired = 2;
      const draftLen = normalized.draftSchedule?.length ?? 0;

      if (played >= legacyRequired && rawVersion < 2) {
        // Legacy pre-seasons finished under the old 2-friendly rule; raising the
        // requirement must not reopen them mid-career.
        return {
          ...normalized,
          friendliesRequired: FRIENDLIES_REQUIRED,
          friendliesPlayed: FRIENDLIES_REQUIRED,
          awaitingChoice: false,
          awaitingScheduleConfirm: false,
          currentChoices: [],
          activeFriendly: null,
          friendlyScheduleVersion: FRIENDLY_SCHEDULE_VERSION,
        };
      }

      // Soft-lock: confirmed UI with only 2 picks after required rose to 3.
      if (
        normalized.awaitingScheduleConfirm &&
        draftLen > 0 &&
        draftLen < FRIENDLIES_REQUIRED
      ) {
        return {
          ...normalized,
          friendliesRequired: FRIENDLIES_REQUIRED,
          awaitingScheduleConfirm: false,
          awaitingChoice: true,
          currentChoices: [],
          friendlyScheduleVersion: FRIENDLY_SCHEDULE_VERSION,
        };
      }

      return repairPreSeasonDeadEnd({
        ...normalized,
        friendliesRequired: FRIENDLIES_REQUIRED,
        friendlyScheduleVersion: FRIENDLY_SCHEDULE_VERSION,
      });
    }
    return repairPreSeasonDeadEnd({
      ...normalized,
      friendlyScheduleVersion: FRIENDLY_SCHEDULE_VERSION,
    });
  }
  if ((career.fixtures?.length ?? 0) > 0 || (career.gameWeek ?? 0) > 0) {
    return {
      friendliesPlayed: FRIENDLIES_REQUIRED,
      friendliesRequired: FRIENDLIES_REQUIRED,
      awaitingChoice: false,
      currentChoices: [],
      draftSchedule: [],
      confirmedSchedule: [],
      awaitingScheduleConfirm: false,
      friendlyScheduleVersion: FRIENDLY_SCHEDULE_VERSION,
      activeFriendly: null,
    };
  }
  return defaultPreSeason();
}

export function getFriendliesRequired(career: ManagerCareer): number {
  return career.preSeason.friendliesRequired ?? FRIENDLIES_REQUIRED;
}

export function needsPreSeasonFriendlies(career: ManagerCareer): boolean {
  return career.preSeason.friendliesPlayed < getFriendliesRequired(career);
}

export function isAwaitingFriendlyChoice(career: ManagerCareer): boolean {
  return (
    needsPreSeasonFriendlies(career) &&
    career.preSeason.awaitingChoice &&
    !career.preSeason.activeFriendly &&
    !career.preSeason.awaitingScheduleConfirm
  );
}

export function isAwaitingFriendlyScheduleConfirm(career: ManagerCareer): boolean {
  return Boolean(
    needsPreSeasonFriendlies(career) &&
      career.preSeason.awaitingScheduleConfirm &&
      (career.preSeason.draftSchedule?.length ?? 0) >= getFriendliesRequired(career)
  );
}

function previousFriendlyClubs(career: ManagerCareer): string[] {
  const clubs: string[] = [];
  for (const f of career.fixtures ?? []) {
    if (f.competition === "friendly" && f.opponent) {
      clubs.push(f.opponent);
    }
  }
  for (const s of career.preSeason.draftSchedule ?? []) {
    clubs.push(s.club);
  }
  return clubs;
}

export function ensureFriendlyChoices(career: ManagerCareer): ManagerCareer {
  if (!needsPreSeasonFriendlies(career)) return career;
  if (career.preSeason.awaitingScheduleConfirm) return career;
  if (!career.preSeason.awaitingChoice || career.preSeason.activeFriendly) {
    return career;
  }
  const draftLen = career.preSeason.draftSchedule?.length ?? 0;
  if (draftLen >= getFriendliesRequired(career)) return career;
  if (career.preSeason.currentChoices.length >= 3) return career;

  const choices = buildFriendlyCandidates(
    career.club,
    career.seed,
    draftLen,
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

function resolveFriendlyVenue(
  career: ManagerCareer,
  friendlyIndex: number
): boolean {
  const rng = seedrandom(
    `${career.seed}-friendly-home-${friendlyIndex}`
  );
  return rng() > 0.35;
}

export function selectFriendlyOpponent(
  career: ManagerCareer,
  choiceId: string
): ManagerCareer {
  const choice = career.preSeason.currentChoices.find((c) => c.id === choiceId);
  if (!choice) return career;

  const draft = [...(career.preSeason.draftSchedule ?? [])];
  const friendlyIndex = draft.length;
  if (draft.some((s) => s.club === choice.club)) return career;

  draft.push({
    club: choice.club,
    year: choice.year,
    displayName: choice.displayName,
    teamRating: choice.teamRating,
    isHome: resolveFriendlyVenue(career, friendlyIndex),
    friendlyIndex,
  });

  const required = getFriendliesRequired(career);
  if (draft.length >= required) {
    return {
      ...career,
      preSeason: {
        ...career.preSeason,
        draftSchedule: draft,
        currentChoices: [],
        awaitingChoice: false,
        awaitingScheduleConfirm: true,
      },
    };
  }

  return ensureFriendlyChoices({
    ...career,
    preSeason: {
      ...career.preSeason,
      draftSchedule: draft,
      currentChoices: [],
      awaitingChoice: true,
    },
  });
}

export function undoLastFriendlyDraftPick(career: ManagerCareer): ManagerCareer {
  const draft = [...(career.preSeason.draftSchedule ?? [])];
  if (draft.length === 0) return career;
  draft.pop();
  return ensureFriendlyChoices({
    ...career,
    preSeason: {
      ...career.preSeason,
      draftSchedule: draft,
      awaitingScheduleConfirm: false,
      awaitingChoice: true,
      activeFriendly: null,
    },
  });
}

export function confirmFriendlySchedule(career: ManagerCareer): ManagerCareer {
  const draft = career.preSeason.draftSchedule ?? [];
  const required = getFriendliesRequired(career);
  if (draft.length < required) return career;

  const confirmed = [...draft];
  const first = confirmed[0]!;

  return {
    ...career,
    preSeason: {
      ...career.preSeason,
      confirmedSchedule: confirmed,
      draftSchedule: confirmed,
      awaitingScheduleConfirm: false,
      awaitingChoice: false,
      activeFriendly: {
        displayName: first.displayName,
        club: first.club,
        year: first.year,
        teamRating: first.teamRating,
        isHome: first.isHome,
        friendlyIndex: first.friendlyIndex,
      },
    },
  };
}

export function autoSelectFriendlyForSim(career: ManagerCareer): {
  career: ManagerCareer;
  autoSelectedClub: string | null;
} {
  if (career.preSeason.awaitingScheduleConfirm) {
    return { career: confirmFriendlySchedule(career), autoSelectedClub: null };
  }

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

  const draftLen = next.preSeason.draftSchedule?.length ?? 0;
  const rng = seedrandom(`${next.seed}-friendly-auto-${draftLen}`);
  const pick = choices[Math.floor(rng() * choices.length)]!;
  next = selectFriendlyOpponent(next, pick.id);

  if (next.preSeason.awaitingScheduleConfirm) {
    next = confirmFriendlySchedule(next);
    return { career: next, autoSelectedClub: pick.club };
  }

  const note = `A friendly against ${pick.club} was added to the pre-season schedule.`;
  return {
    career: appendFriendlyAutoNote(next, note, draftLen),
    autoSelectedClub: pick.club,
  };
}

function appendFriendlyAutoNote(
  career: ManagerCareer,
  note: string,
  friendlyIndex: number
): ManagerCareer {
  const newsItem: LatestNewsItem = {
    id: `news-friendly-auto-${career.seasonYear}-${friendlyIndex}`,
    week: career.gameWeek,
    type: "fixture",
    text: note,
  };
  const inbox: InboxMessage = {
    id: `inbox-friendly-auto-${career.seasonYear}-${friendlyIndex}`,
    type: "fixture",
    title: "Friendly arranged",
    body: note,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date(0).toISOString(),
    read: false,
  };
  const existingNews = (career.latestNews ?? []).some((n) => n.id === newsItem.id);
  const existingInbox = (career.inboxMessages ?? []).some((m) => m.id === inbox.id);
  return {
    ...career,
    latestNews: existingNews
      ? career.latestNews
      : [newsItem, ...(career.latestNews ?? [])].slice(0, 24),
    inboxMessages: existingInbox
      ? career.inboxMessages
      : [inbox, ...(career.inboxMessages ?? [])].slice(0, 80),
  };
}

export function completeFriendlyMatch(career: ManagerCareer): ManagerCareer {
  const played = career.preSeason.friendliesPlayed + 1;
  const required = getFriendliesRequired(career);
  const schedule = career.preSeason.confirmedSchedule ?? [];
  const nextScheduled = schedule[played] ?? null;

  // No confirmed opponent left to face (legacy schedules), so pre-season is over.
  if (played >= required || !nextScheduled) {
    return {
      ...career,
      preSeason: {
        ...career.preSeason,
        friendliesPlayed: Math.max(played, required),
        awaitingChoice: false,
        awaitingScheduleConfirm: false,
        currentChoices: [],
        activeFriendly: null,
      },
    };
  }

  return {
    ...career,
    preSeason: {
      ...career.preSeason,
      friendliesPlayed: played,
      awaitingChoice: false,
      awaitingScheduleConfirm: false,
      currentChoices: [],
      activeFriendly: {
        displayName: nextScheduled.displayName,
        club: nextScheduled.club,
        year: nextScheduled.year,
        teamRating: nextScheduled.teamRating,
        isHome: nextScheduled.isHome,
        friendlyIndex: nextScheduled.friendlyIndex,
      },
    },
  };
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
    return teamRating >= 84 ? "medium" : "low";
  }
  if (teamRating >= 88) return "high";
  if (teamRating >= 84) return "medium";
  return "low";
}

export { defaultPreSeason };
