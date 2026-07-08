import { POSITION_LABELS, POSITION_SHORT } from "../positions";
import type { Position } from "../types";
import { pushInboxMessage } from "./managerInbox";
import {
  getManagerPlayer,
  getManagerPlayerEligiblePositions,
} from "./managerPlayers";
import type { ManagerCareer, PlayerPositionRetraining } from "./types";
import type { InboxMessage } from "./types";

/** Manager calendar — four game weeks per month (matches reserve reports). */
export const WEEKS_PER_MONTH = 4;

export interface PositionRetrainingPath {
  from: Position;
  to: Position;
  months: number;
}

/** Allowed primary → dual position retraining paths and durations. */
export const POSITION_RETRAINING_PATHS: PositionRetrainingPath[] = [
  { from: "CENTRE", to: "SECOND_ROW", months: 2 },
  { from: "CENTRE", to: "WING", months: 2 },
  { from: "WING", to: "CENTRE", months: 3 },
  { from: "SECOND_ROW", to: "PROP", months: 3 },
  { from: "PROP", to: "SECOND_ROW", months: 2 },
  { from: "HOOKER", to: "STAND_OFF", months: 6 },
  { from: "HOOKER", to: "SCRUM_HALF", months: 6 },
  { from: "HOOKER", to: "LOOSE_FORWARD", months: 5 },
  { from: "WING", to: "FULLBACK", months: 1 },
  { from: "STAND_OFF", to: "FULLBACK", months: 2 },
  { from: "SCRUM_HALF", to: "FULLBACK", months: 2 },
  { from: "STAND_OFF", to: "HOOKER", months: 4 },
  { from: "SCRUM_HALF", to: "HOOKER", months: 4 },
  { from: "SECOND_ROW", to: "LOOSE_FORWARD", months: 6 },
  { from: "LOOSE_FORWARD", to: "STAND_OFF", months: 12 },
  { from: "LOOSE_FORWARD", to: "SCRUM_HALF", months: 12 },
  { from: "FULLBACK", to: "WING", months: 1 },
  { from: "FULLBACK", to: "STAND_OFF", months: 5 },
  { from: "FULLBACK", to: "SCRUM_HALF", months: 5 },
];

export function retrainingPathKey(from: Position, to: Position): string {
  return `${from}->${to}`;
}

export function getRetrainingDurationWeeks(months: number): number {
  return months * WEEKS_PER_MONTH;
}

export function formatRetrainingDuration(months: number): string {
  if (months >= 12 && months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? "1 year" : `${years} years`;
  }
  return `${months} month${months === 1 ? "" : "s"}`;
}

export function formatRetrainingPathLabel(from: Position, to: Position): string {
  return `${POSITION_SHORT[from]} → ${POSITION_SHORT[to]}`;
}

export function getPlayerPrimaryPosition(
  career: ManagerCareer,
  playerId: string
): Position | null {
  const player = getManagerPlayer(career, playerId);
  return player?.position ?? null;
}

export function isPlayerInFirstTeamSquad(
  career: ManagerCareer,
  playerId: string
): boolean {
  return career.squad.some((p) => p.playerId === playerId);
}

export function getActiveRetraining(
  career: ManagerCareer,
  playerId: string
): PlayerPositionRetraining | null {
  return career.playerPositionRetraining[playerId] ?? null;
}

export function listActiveRetraining(
  career: ManagerCareer
): { playerId: string; training: PlayerPositionRetraining }[] {
  const map = career.playerPositionRetraining;
  return Object.entries(map).map(([playerId, training]) => ({
    playerId,
    training,
  }));
}

export function getRetrainingProgress(
  training: PlayerPositionRetraining
): number {
  if (training.totalWeeks <= 0) return 1;
  return Math.max(
    0,
    Math.min(1, (training.totalWeeks - training.weeksRemaining) / training.totalWeeks)
  );
}

export function playerHasDualPositions(
  career: ManagerCareer,
  playerId: string
): boolean {
  return getManagerPlayerEligiblePositions(career, playerId).length > 1;
}

export type PlayerRetrainingStatus =
  | "available"
  | "training"
  | "already_dual"
  | "no_paths";

export function getPlayerRetrainingStatus(
  career: ManagerCareer,
  playerId: string
): PlayerRetrainingStatus {
  if (getActiveRetraining(career, playerId)) return "training";
  if (playerHasDualPositions(career, playerId)) return "already_dual";
  if (getAvailableRetrainingTargets(career, playerId).length > 0) {
    return "available";
  }
  return "no_paths";
}

export function getAvailableRetrainingTargets(
  career: ManagerCareer,
  playerId: string
): PositionRetrainingPath[] {
  if (!isPlayerInFirstTeamSquad(career, playerId)) return [];
  if (getActiveRetraining(career, playerId)) return [];
  if (playerHasDualPositions(career, playerId)) return [];

  const primary = getPlayerPrimaryPosition(career, playerId);
  if (!primary) return [];

  const eligible = new Set(getManagerPlayerEligiblePositions(career, playerId));

  return POSITION_RETRAINING_PATHS.filter(
    (path) =>
      path.from === primary &&
      !eligible.has(path.to) &&
      path.to !== primary
  );
}

export function startPositionRetraining(
  career: ManagerCareer,
  playerId: string,
  targetPosition: Position
): { ok: true; career: ManagerCareer } | { ok: false; message: string } {
  if (!isPlayerInFirstTeamSquad(career, playerId)) {
    return { ok: false, message: "Only first-team squad players can retrain." };
  }

  if (getActiveRetraining(career, playerId)) {
    return {
      ok: false,
      message: "This player is already retraining for another position.",
    };
  }

  if (playerHasDualPositions(career, playerId)) {
    return {
      ok: false,
      message: "This player already has a dual position and cannot retrain.",
    };
  }

  const primary = getPlayerPrimaryPosition(career, playerId);
  if (!primary) {
    return { ok: false, message: "Could not resolve this player's position." };
  }

  const path = POSITION_RETRAINING_PATHS.find(
    (p) => p.from === primary && p.to === targetPosition
  );
  if (!path) {
    return {
      ok: false,
      message: `Cannot retrain from ${POSITION_LABELS[primary]} to ${POSITION_LABELS[targetPosition]}.`,
    };
  }

  const eligible = getManagerPlayerEligiblePositions(career, playerId);
  if (eligible.includes(targetPosition)) {
    return {
      ok: false,
      message: "This player is already eligible for that position.",
    };
  }

  const totalWeeks = getRetrainingDurationWeeks(path.months);
  const player = getManagerPlayer(career, playerId);
  const training: PlayerPositionRetraining = {
    fromPosition: primary,
    targetPosition,
    weeksRemaining: totalWeeks,
    totalWeeks,
    startedAtWeek: career.gameWeek,
    startedAtSeason: career.seasonYear,
  };

  let nextCareer: ManagerCareer = {
    ...career,
    playerPositionRetraining: {
      ...career.playerPositionRetraining,
      [playerId]: training,
    },
    updatedAt: new Date().toISOString(),
  };

  nextCareer = pushInboxMessage(nextCareer, {
    id: `retrain-start-${playerId}-${career.seasonYear}-w${career.gameWeek}-${targetPosition}`,
    type: "general",
    title: "Position retraining started",
    body: `${player?.name ?? "Player"} began retraining from ${POSITION_LABELS[primary]} to ${POSITION_LABELS[targetPosition]} (${formatRetrainingDuration(path.months)}).`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    playerId,
    playerName: player?.name,
  });

  return { ok: true, career: nextCareer };
}

function completeRetraining(
  career: ManagerCareer,
  playerId: string,
  training: PlayerPositionRetraining
): ManagerCareer {
  const learned = career.playerLearnedPositions;
  const existing = learned[playerId] ?? [];
  const nextLearned = existing.includes(training.targetPosition)
    ? existing
    : [...existing, training.targetPosition];

  const player = getManagerPlayer(career, playerId);
  let next: ManagerCareer = {
    ...career,
    playerLearnedPositions: {
      ...learned,
      [playerId]: nextLearned,
    },
  };

  next = pushInboxMessage(next, {
    id: `retrain-complete-${playerId}-${career.seasonYear}-w${career.gameWeek}-${training.targetPosition}`,
    type: "position_retraining_complete",
    title: "Retraining complete",
    body: `${player?.name ?? "Player"} can now play ${POSITION_LABELS[training.targetPosition]} as well as ${POSITION_LABELS[training.fromPosition]}.`,
    week: career.gameWeek,
    season: career.seasonYear,
    gameWeek: career.gameWeek,
    createdAt: new Date().toISOString(),
    read: false,
    resolved: false,
    playerId,
    playerName: player?.name,
    retrainingFrom: training.fromPosition,
    retrainingTo: training.targetPosition,
  });

  return next;
}

/** Unread dual-position retraining completion — surfaced as a post-match popup. */
export function getPendingPositionRetrainingPopup(
  career: ManagerCareer
): InboxMessage | undefined {
  return career.inboxMessages.find(
    (m) => m.type === "position_retraining_complete" && !m.read
  );
}

export function acknowledgePositionRetrainingPopup(
  career: ManagerCareer,
  messageId: string
): ManagerCareer {
  return {
    ...career,
    inboxMessages: career.inboxMessages.map((m) =>
      m.id === messageId ? { ...m, read: true, resolved: true } : m
    ),
    updatedAt: new Date().toISOString(),
  };
}

/** Advance all active retraining by one league week. */
export function tickPositionRetraining(career: ManagerCareer): ManagerCareer {
  const retraining = career.playerPositionRetraining;
  if (Object.keys(retraining).length === 0) return career;

  let nextCareer = career;
  const nextRetraining = { ...retraining };

  for (const [playerId, training] of Object.entries(retraining)) {
    const weeksRemaining = training.weeksRemaining - 1;
    if (weeksRemaining <= 0) {
      delete nextRetraining[playerId];
      nextCareer = completeRetraining(nextCareer, playerId, training);
    } else {
      nextRetraining[playerId] = { ...training, weeksRemaining };
    }
  }

  return {
    ...nextCareer,
    playerPositionRetraining: nextRetraining,
    updatedAt: new Date().toISOString(),
  };
}
