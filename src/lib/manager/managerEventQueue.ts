/**
 * Central Manager Mode event queue — single coordination point for weekly
 * popups / inbox announcements. Does not replace inbox messages; it queues
 * which ids interrupt the player after Advance Week / Sim to Date.
 *
 * Persistence lives on the career:
 * - pendingManagerEventIds
 * - acknowledgedManagerEventIds
 *
 * Story / milestone content is authored in managerWorldStory + inbox helpers.
 * Celebration / promotion modals stay on the existing celebration chain.
 */

import type { ManagerCareer } from "./types";
import {
  acknowledgeManagerEventId,
  collectWeeklyManagerEventIds,
  withWeeklyManagerEventQueue,
} from "./managerMatchWeek";

export type ManagerEventType =
  | "TRANSFER"
  | "LOAN"
  | "CONTRACT"
  | "PLAYER_DEVELOPMENT"
  | "MILESTONE"
  | "FIXTURE"
  | "LEAGUE"
  | "CUP"
  | "PLAYOFF"
  | "PROMOTION"
  | "RELEGATION"
  | "SEASON"
  | "BOARD"
  | "STORY"
  | "RETIREMENT"
  | "RESERVE";

export type ManagerEventPriority = "critical" | "important" | "minor";

export interface ManagerEventMeta {
  id: string;
  type: ManagerEventType;
  priority: ManagerEventPriority;
}

/** Classify an event id for presentation / throttling hints. */
export function classifyManagerEventId(id: string): ManagerEventMeta {
  const lower = id.toLowerCase();
  if (lower.includes("promotion") || lower.startsWith("promo-")) {
    return { id, type: "PROMOTION", priority: "critical" };
  }
  if (lower.includes("relegation") || lower.startsWith("releg-")) {
    return { id, type: "RELEGATION", priority: "critical" };
  }
  if (lower.includes("million") || lower.includes("mpg")) {
    return { id, type: "PLAYOFF", priority: "critical" };
  }
  if (lower.includes("trophy") || lower.includes("champions") || lower.includes("wcc")) {
    return { id, type: "SEASON", priority: "critical" };
  }
  if (
    lower.includes("bid") ||
    lower.includes("offer") ||
    lower.startsWith("transfer") ||
    lower.includes("unsolicited")
  ) {
    return { id, type: "TRANSFER", priority: "important" };
  }
  if (lower.includes("loan")) {
    return { id, type: "LOAN", priority: "important" };
  }
  if (lower.includes("contract") || lower.includes("expiry")) {
    return { id, type: "CONTRACT", priority: "important" };
  }
  if (lower.includes("retire")) {
    return { id, type: "RETIREMENT", priority: "important" };
  }
  if (lower.includes("retrain") || lower.includes("position")) {
    return { id, type: "PLAYER_DEVELOPMENT", priority: "important" };
  }
  if (lower.includes("reserve")) {
    return { id, type: "RESERVE", priority: "minor" };
  }
  if (lower.includes("cup") || lower.includes("giant") || lower.includes("semi")) {
    return { id, type: "CUP", priority: "important" };
  }
  if (
    lower.includes("league") ||
    lower.includes("playoff") ||
    lower.includes("table") ||
    lower.includes("survival")
  ) {
    return { id, type: "LEAGUE", priority: "important" };
  }
  if (
    lower.includes("breakthrough") ||
    lower.includes("apps-") ||
    lower.includes("milestone") ||
    lower.includes("streak") ||
    lower.includes("career-win")
  ) {
    return { id, type: "MILESTONE", priority: "important" };
  }
  if (
    lower.includes("rival") ||
    lower.includes("big-match") ||
    lower.includes("former") ||
    lower.includes("title-race") ||
    lower.includes("magic")
  ) {
    return { id, type: "FIXTURE", priority: "important" };
  }
  if (lower.startsWith("board-") || lower.includes("board")) {
    return { id, type: "BOARD", priority: "important" };
  }
  if (lower.startsWith("story-")) {
    return { id, type: "STORY", priority: "important" };
  }
  return { id, type: "STORY", priority: "minor" };
}

/**
 * Rebuild the weekly interrupt queue from live pending systems.
 * Call after Advance Week / match apply / Sim to Date.
 * At most the existing collectors run — no duplicate inventing.
 */
export function enqueueWeeklyManagerEvents(
  career: ManagerCareer
): ManagerCareer {
  const ids = collectWeeklyManagerEventIds(career);
  // Prefer critical/important first while preserving collector order within tier.
  const ranked = [...ids].sort((a, b) => {
    const pa = classifyManagerEventId(a).priority;
    const pb = classifyManagerEventId(b).priority;
    const rank = (p: ManagerEventPriority) =>
      p === "critical" ? 0 : p === "important" ? 1 : 2;
    return rank(pa) - rank(pb);
  });
  return withWeeklyManagerEventQueue(career, ranked);
}

export function markManagerEventSeen(
  career: ManagerCareer,
  eventId: string
): ManagerCareer {
  return acknowledgeManagerEventId(career, eventId);
}

/** Cap how many story/inbox interrupts surface after one week tick. */
export const MAX_WEEKLY_INTERRUPT_POPUPS = 2;

export function throttlePendingManagerEvents(
  career: ManagerCareer,
  max = MAX_WEEKLY_INTERRUPT_POPUPS
): ManagerCareer {
  const pending = career.pendingManagerEventIds ?? [];
  if (pending.length <= max) return career;

  const keep: string[] = [];
  const defer: string[] = [];
  for (const id of pending) {
    const { priority } = classifyManagerEventId(id);
    if (priority === "critical" || keep.length < max) {
      keep.push(id);
    } else {
      defer.push(id);
    }
  }
  // Deferred stay pending for a later week — do not acknowledge them.
  return {
    ...career,
    pendingManagerEventIds: [...keep, ...defer],
  };
}
