import type {
  InboxMessage,
  ManagerCareer,
  ManagerFixtureRecord,
  ManagerScheduledFixture,
} from "./types";
import { getManagerScheduledFixtureVenueLabel } from "./managerFixtureDisplay";
import { getUnavailableSquadPlayers } from "./managerSquad";
import { countExpiringContracts } from "./managerContracts";

export type MatchWeekPhase =
  | "ready_to_play"
  | "awaiting_advance"
  | "season_complete";

/** Stable id for the week unlocked by a completed fixture. */
export function buildMatchWeekId(
  career: ManagerCareer,
  fixtureId: string,
  round: number
): string {
  return `${career.seasonYear}:${fixtureId}:r${round}`;
}

export function getMatchWeekPhase(career: ManagerCareer): MatchWeekPhase {
  if (career.isSeasonComplete || career.matchWeekPhase === "season_complete") {
    return "season_complete";
  }
  if (career.matchWeekPhase === "awaiting_advance") {
    return "awaiting_advance";
  }
  return "ready_to_play";
}

export function canPlayNextMatch(career: ManagerCareer): boolean {
  return (
    getMatchWeekPhase(career) === "ready_to_play" && !career.isSeasonComplete
  );
}

export function getMatchWeekActionLabel(
  career: ManagerCareer,
  processing = false
): string {
  if (processing) return "Processing Match Week…";
  const phase = getMatchWeekPhase(career);
  if (phase === "season_complete") return "Season Complete";
  if (phase === "awaiting_advance") return "Continue to Next Match Week";
  return "Play Next Match";
}

export function markAwaitingMatchWeekAdvance(
  career: ManagerCareer,
  weekId: string
): ManagerCareer {
  if (career.isSeasonComplete) {
    return {
      ...career,
      matchWeekPhase: "season_complete",
      pendingMatchWeekId: null,
    };
  }
  return {
    ...career,
    matchWeekPhase: "awaiting_advance",
    pendingMatchWeekId: weekId,
  };
}

/** Blocks duplicate Continue presses for the same week id. */
export function wasMatchWeekProcessed(
  career: ManagerCareer,
  weekId: string | null | undefined
): boolean {
  if (!weekId) return false;
  return career.lastProcessedMatchWeekId === weekId;
}

export interface MatchWeekPanelInfo {
  phase: MatchWeekPhase;
  currentWeek: number;
  seasonGames: number;
  lastResult: {
    opponent: string;
    pointsFor: number;
    pointsAgainst: number;
    result: "W" | "L" | "D";
    competition?: string;
  } | null;
  nextFixture: ManagerScheduledFixture | null;
  nextVenue: string | null;
  unreadInboxCount: number;
  availabilityWarnings: string[];
  contractAlerts: string[];
  transferAlerts: string[];
  actionLabel: string;
  canAdvance: boolean;
  canPlay: boolean;
}

function lastResultSummary(
  last: ManagerFixtureRecord | null
): MatchWeekPanelInfo["lastResult"] {
  if (!last) return null;
  return {
    opponent: last.opponent,
    pointsFor: last.pointsFor,
    pointsAgainst: last.pointsAgainst,
    result: last.result,
    competition: last.competition,
  };
}

function unreadInbox(career: ManagerCareer): InboxMessage[] {
  return (career.inboxMessages ?? []).filter((m) => !m.read && !m.resolved);
}

export function getMatchWeekPanelInfo(
  career: ManagerCareer,
  options?: {
    processing?: boolean;
    /** Caller supplies next / peeked fixture. */
    nextFixture?: ManagerScheduledFixture | null;
  }
): MatchWeekPanelInfo {
  const phase = getMatchWeekPhase(career);
  const next = options?.nextFixture ?? null;

  const unavailable = getUnavailableSquadPlayers(career);
  const injured = unavailable.filter((p) => p.injury?.type !== "suspension");
  const suspended = unavailable.filter((p) => p.injury?.type === "suspension");
  const availabilityWarnings: string[] = [];
  if (injured.length > 0) {
    availabilityWarnings.push(
      `${injured.length} injured player${injured.length === 1 ? "" : "s"}`
    );
  }
  if (suspended.length > 0) {
    availabilityWarnings.push(
      `${suspended.length} suspension${suspended.length === 1 ? "" : "s"}`
    );
  }

  const expiring = countExpiringContracts(career.contracts);
  const contractAlerts: string[] = [];
  if (expiring > 0) {
    contractAlerts.push(
      `${expiring} contract${expiring === 1 ? "" : "s"} expiring soon`
    );
  }

  const transferAlerts: string[] = [];
  const openOffers = (career.inboxMessages ?? []).filter(
    (m) => m.type === "transfer" && !m.resolved
  ).length;
  if (openOffers > 0) {
    transferAlerts.push(
      `${openOffers} open transfer offer${openOffers === 1 ? "" : "s"}`
    );
  }

  const processing = options?.processing ?? false;

  return {
    phase,
    currentWeek: career.gameWeek,
    seasonGames: career.schedule.length,
    lastResult: lastResultSummary(career.lastMatchFixture),
    nextFixture: next,
    nextVenue: next ? getManagerScheduledFixtureVenueLabel(next) : null,
    unreadInboxCount: unreadInbox(career).length,
    availabilityWarnings,
    contractAlerts,
    transferAlerts,
    actionLabel: getMatchWeekActionLabel(career, processing),
    canAdvance: phase === "awaiting_advance" && !processing,
    canPlay: canPlayNextMatch(career) && !processing,
  };
}

/**
 * Migrate older saves into a coherent Match Week phase without resetting progress.
 */
export function migrateMatchWeekFields(career: ManagerCareer): ManagerCareer {
  if (career.isSeasonComplete) {
    return {
      ...career,
      matchWeekPhase: career.matchWeekPhase ?? "season_complete",
      pendingMatchWeekId: career.pendingMatchWeekId ?? null,
      lastProcessedMatchWeekId: career.lastProcessedMatchWeekId ?? null,
    };
  }

  // Existing saves already advanced the calendar after each match → ready to play.
  if (!career.matchWeekPhase) {
    return {
      ...career,
      matchWeekPhase: "ready_to_play",
      pendingMatchWeekId: null,
      lastProcessedMatchWeekId: career.lastProcessedMatchWeekId ?? null,
    };
  }

  return {
    ...career,
    pendingMatchWeekId: career.pendingMatchWeekId ?? null,
    lastProcessedMatchWeekId: career.lastProcessedMatchWeekId ?? null,
  };
}
