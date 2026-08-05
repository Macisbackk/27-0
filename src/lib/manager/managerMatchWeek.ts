import type { ManagerCareer } from "./types";
import {
  getPendingIncomingClubBid,
  getPendingIncomingClubBids,
} from "./managerTransferLeague";
import { getPendingContractExpiryPopup } from "./managerInbox";
import { getPendingRetirementIntentPopup } from "./managerRetirement";
import { getPendingPositionRetrainingPopup } from "./managerPositionRetraining";
import { getPendingReserveReportPopup } from "./managerReserveReports";
import { getPendingBoardInboxPopup } from "./managerBoardInbox";

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

/** Next Fixture Play/Simulate — only when the calendar is ready. */
export function canPlayNextMatch(career: ManagerCareer): boolean {
  return (
    getMatchWeekPhase(career) === "ready_to_play" && !career.isSeasonComplete
  );
}

/** Unresolved decisions that must be handled before advancing again. */
export function hasBlockingManagerDecision(career: ManagerCareer): boolean {
  return Boolean(
    getPendingIncomingClubBid(career) ||
      getPendingRetirementIntentPopup(career)
  );
}

/** Season Progress Advance Week — after a fixture, before the next is unlocked. */
export function canAdvanceMatchWeek(career: ManagerCareer): boolean {
  return (
    getMatchWeekPhase(career) === "awaiting_advance" &&
    !hasBlockingManagerDecision(career)
  );
}

export function getAdvanceWeekButtonLabel(
  career: ManagerCareer,
  processing = false
): { full: string; short: string } {
  if (processing) return { full: "Advancing…", short: "…" };
  if (getMatchWeekPhase(career) === "season_complete") {
    return { full: "Season Complete", short: "Done" };
  }
  return { full: "Advance Week", short: "Advance" };
}

export function getAdvanceWeekHint(career: ManagerCareer): string | null {
  const phase = getMatchWeekPhase(career);
  if (phase === "season_complete") {
    return "Season complete — open season review.";
  }
  if (hasBlockingManagerDecision(career)) {
    return "Resolve pending decisions first.";
  }
  if (phase === "awaiting_advance") return null;
  return "Play your current fixture before advancing.";
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

/** Blocks duplicate Advance Week presses for the same week id. */
export function wasMatchWeekProcessed(
  career: ManagerCareer,
  weekId: string | null | undefined
): boolean {
  if (!weekId) return false;
  return career.lastProcessedMatchWeekId === weekId;
}

/**
 * Collect weekly popup event ids from career inbox (decision first, then info).
 * Skips ids already acknowledged.
 */
export function collectWeeklyManagerEventIds(career: ManagerCareer): string[] {
  const acked = new Set(career.acknowledgedManagerEventIds ?? []);
  const ids: string[] = [];
  const push = (id: string | undefined) => {
    if (id && !acked.has(id) && !ids.includes(id)) ids.push(id);
  };

  for (const bid of getPendingIncomingClubBids(career)) {
    push(bid.id);
  }
  push(getPendingRetirementIntentPopup(career)?.id);
  push(getPendingBoardInboxPopup(career)?.id);
  push(getPendingContractExpiryPopup(career)?.id);
  push(getPendingPositionRetrainingPopup(career)?.id);
  push(getPendingReserveReportPopup(career)?.id);

  return ids;
}

export function withWeeklyManagerEventQueue(
  career: ManagerCareer,
  eventIds: string[]
): ManagerCareer {
  const acked = new Set(career.acknowledgedManagerEventIds ?? []);
  const pending = eventIds.filter((id) => !acked.has(id));
  return {
    ...career,
    pendingManagerEventIds: pending,
    acknowledgedManagerEventIds: career.acknowledgedManagerEventIds ?? [],
  };
}

export function acknowledgeManagerEventId(
  career: ManagerCareer,
  eventId: string
): ManagerCareer {
  const acked = new Set(career.acknowledgedManagerEventIds ?? []);
  acked.add(eventId);
  const pending = (career.pendingManagerEventIds ?? []).filter(
    (id) => id !== eventId
  );
  return {
    ...career,
    pendingManagerEventIds: pending,
    acknowledgedManagerEventIds: [...acked],
  };
}

/**
 * Migrate older saves into a coherent Match Week phase without resetting progress.
 * Session-only advancing flags are never left stuck true.
 */
export function migrateMatchWeekFields(career: ManagerCareer): ManagerCareer {
  if (career.isSeasonComplete) {
    return {
      ...career,
      matchWeekPhase: career.matchWeekPhase ?? "season_complete",
      pendingMatchWeekId: career.pendingMatchWeekId ?? null,
      lastProcessedMatchWeekId: career.lastProcessedMatchWeekId ?? null,
      pendingManagerEventIds: career.pendingManagerEventIds ?? [],
      acknowledgedManagerEventIds: career.acknowledgedManagerEventIds ?? [],
    };
  }

  // Existing saves already advanced the calendar after each match → ready to play.
  if (!career.matchWeekPhase) {
    return {
      ...career,
      matchWeekPhase: "ready_to_play",
      pendingMatchWeekId: null,
      lastProcessedMatchWeekId: career.lastProcessedMatchWeekId ?? null,
      pendingManagerEventIds: career.pendingManagerEventIds ?? [],
      acknowledgedManagerEventIds: career.acknowledgedManagerEventIds ?? [],
    };
  }

  return {
    ...career,
    pendingMatchWeekId: career.pendingMatchWeekId ?? null,
    lastProcessedMatchWeekId: career.lastProcessedMatchWeekId ?? null,
    pendingManagerEventIds: career.pendingManagerEventIds ?? [],
    acknowledgedManagerEventIds: career.acknowledgedManagerEventIds ?? [],
  };
}
