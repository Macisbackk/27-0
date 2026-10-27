/**
 * Classic draft flow helpers (pure — see scripts/test-draft-flow.ts).
 *
 * - Spin lock: once a spin lands on a slot, that slot owns the run's current spin until a
 *   player is signed there. Backing out to the team sheet and tapping another slot reopens
 *   the locked spin instead of rolling a new one, so nobody can peek at every slot's result
 *   and pick the best order (matters most on the seeded Daily / Weekly).
 * - Auto-advance: after a signing, the next empty slot in team-sheet order is suggested.
 * - Honest progress: "Squad n/13" → "Season" → "Play-offs".
 */
import { FORMATION_SLOT_INDICES } from "../positions";
import type { SquadSlot } from "../types";

/**
 * Club choice (v1.40): normal Classic (2026 squads) spins for the tapped position and offers
 * three cards from three different clubs, so club links (chemistry) are something you build.
 * Era, One-Club XI, the Gauntlet and the seeded Daily / Weekly keep the club spin (one club,
 * pick one of its cards). A challenge link replays the challenger's flow.
 */
export function usesClubChoiceSpin(opts: {
  slotRecruitMode: boolean;
  spinVariant: "current" | "era" | "all";
  dailyChallengeMode: boolean;
  weeklyChallengeMode: boolean;
  /** One-Club XI, Gauntlet or a past Daily. */
  sideMode: boolean;
  /** Challenge link kind ("classic" replays a normal Classic run). */
  challengeKind?: "classic" | "daily" | "weekly" | null;
}): boolean {
  return (
    opts.slotRecruitMode &&
    opts.spinVariant === "current" &&
    !opts.dailyChallengeMode &&
    !opts.weeklyChallengeMode &&
    !opts.sideMode &&
    (opts.challengeKind == null || opts.challengeKind === "classic")
  );
}

/** The 27-0 formula ladder for a league season (see sim-formula.ts). */
export function getRunFormulaMode(opts: {
  eraCards: boolean;
  clubChoice: boolean;
}): "classic" | "classic-spin" | "era" {
  if (opts.eraCards) return "era";
  return opts.clubChoice ? "classic" : "classic-spin";
}

export interface SpinRequestResolution {
  /** Slot whose spin opens. */
  slotIndex: number;
  /** True when the tap was redirected to the slot that already holds a landed spin. */
  redirected: boolean;
  /** True when the slot already has a landed spin (reopen the picker; never re-roll). */
  reopenLocked: boolean;
}

/**
 * Which slot a tap on `requestedSlot` should open, given the slot (if any) that holds the
 * landed-but-unsigned spin. A landed spin is never re-rolled by backing out.
 */
export function resolveSpinRequest(
  lockedSlot: number | null,
  requestedSlot: number
): SpinRequestResolution {
  if (lockedSlot === null) {
    return { slotIndex: requestedSlot, redirected: false, reopenLocked: false };
  }
  return {
    slotIndex: lockedSlot,
    redirected: lockedSlot !== requestedSlot,
    reopenLocked: true,
  };
}

/** Next empty slot after `afterSlotIndex` in team-sheet order (wrapping), or null when full. */
export function getNextEmptySlotIndex(
  squad: SquadSlot[],
  afterSlotIndex: number | null,
  skipSlots: readonly number[] = []
): number | null {
  const order = FORMATION_SLOT_INDICES as readonly number[];
  const isEmpty = (idx: number) =>
    !skipSlots.includes(idx) && squad.some((s) => s.slotIndex === idx && !s.player);
  const start = afterSlotIndex === null ? -1 : order.indexOf(afterSlotIndex);
  for (let step = 1; step <= order.length; step++) {
    const idx = order[(start + step + order.length) % order.length];
    if (isEmpty(idx)) return idx;
  }
  return null;
}

export type RunProgressStage = "squad" | "season" | "playoffs";

export interface RunProgressStep {
  id: RunProgressStage;
  label: string;
  state: "done" | "active" | "todo";
}

export function buildRunProgressSteps(
  stage: RunProgressStage,
  filledCount: number,
  totalSlots: number
): RunProgressStep[] {
  const order: RunProgressStage[] = ["squad", "season", "playoffs"];
  const activeIdx = order.indexOf(stage);
  const labels: Record<RunProgressStage, string> = {
    squad: `Squad ${Math.min(filledCount, totalSlots)}/${totalSlots}`,
    season: "Season",
    "playoffs": "Play-offs",
  };
  return order.map((id, i) => ({
    id,
    label: labels[id],
    state: i < activeIdx ? "done" : i === activeIdx ? "active" : "todo",
  }));
}
