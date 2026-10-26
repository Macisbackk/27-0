/**
 * Save / resume a half-built Classic run (one slot per mode on this device).
 *
 * The snapshot keeps the run's seed and id, the squad so far, the spin index, respins left,
 * the team-years already used, the legend-spin state and any landed-but-unsigned spin. A
 * resumed run is the same run: the same seed and spin index give the same spins, and a
 * landed spin comes back locked to its slot. The Daily / Weekly resume the same attempt
 * (same run id, so it still counts) and are thrown away once the day / week has moved on.
 *
 * Snapshots are cleared when the season kicks off (the result is recorded from then on) or
 * when the player starts over.
 */
import type { SquadSlot } from "../types";
import type { SlotRevealTarget } from "./recruitment-slot-reveal";
import { TOTAL_SLOTS } from "../positions";

export const RUN_RESUME_VERSION = 1;
export const RUN_RESUME_KEY_PREFIX = "27-0-run-resume-";

export type ResumeModeKey =
  | "classic"
  | "era"
  | "daily"
  | "weekly"
  | "bk-classic"
  | "bk-era";

export interface ResumePendingSpin {
  slotIndex: number;
  target: SlotRevealTarget;
}

export interface RunResumeSnapshot {
  v: typeof RUN_RESUME_VERSION;
  modeKey: ResumeModeKey;
  seed: string;
  runId: string;
  /** ISO time the run started (Daily / Weekly scenario is frozen from it). */
  startedAt: string;
  squad: SquadSlot[];
  spinPickIndex: number;
  respinsRemaining: number;
  usedTeamYearKeys: string[];
  legendSpinSlotIndex: number | null;
  legendSpinUsed: boolean;
  pendingSpin: ResumePendingSpin | null;
  savedAt: string;
}

export function getResumeModeKey(opts: {
  dailyChallengeMode: boolean;
  weeklyChallengeMode: boolean;
  normalEraMode: boolean;
  ballKnower: boolean;
  hiddenMode: boolean;
}): ResumeModeKey | null {
  if (opts.hiddenMode) return null;
  if (opts.dailyChallengeMode) return "daily";
  if (opts.weeklyChallengeMode) return "weekly";
  if (opts.ballKnower) return opts.normalEraMode ? "bk-era" : "bk-classic";
  return opts.normalEraMode ? "era" : "classic";
}

export function getResumeStorageKey(modeKey: ResumeModeKey): string {
  return `${RUN_RESUME_KEY_PREFIX}${modeKey}`;
}

export function snapshotHasProgress(s: Pick<RunResumeSnapshot, "squad" | "pendingSpin">): boolean {
  return s.pendingSpin !== null || s.squad.some((slot) => slot.player);
}

function isTarget(value: unknown): value is SlotRevealTarget {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.team === "string" &&
    typeof t.year === "string" &&
    typeof t.teamYearKey === "string" &&
    typeof t.teamYearId === "string"
  );
}

function isSquad(value: unknown): value is SquadSlot[] {
  if (!Array.isArray(value) || value.length !== TOTAL_SLOTS) return false;
  return value.every((slot) => {
    if (!slot || typeof slot !== "object") return false;
    const s = slot as Record<string, unknown>;
    if (typeof s.slotIndex !== "number" || typeof s.label !== "string") return false;
    if (s.player === null) return true;
    const p = s.player as Record<string, unknown> | undefined;
    return !!p && typeof p.id === "string" && typeof p.name === "string";
  });
}

/**
 * Validate a stored snapshot. Returns null for anything malformed, for another mode, for a
 * snapshot with no progress, or (Daily / Weekly) when `expectedSeed` no longer matches —
 * i.e. the day or week has rolled over.
 */
export function parseRunResumeSnapshot(
  raw: unknown,
  modeKey: ResumeModeKey,
  expectedSeed?: string
): RunResumeSnapshot | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  if (s.v !== RUN_RESUME_VERSION || s.modeKey !== modeKey) return null;
  if (typeof s.seed !== "string" || typeof s.runId !== "string" || typeof s.startedAt !== "string") {
    return null;
  }
  if (expectedSeed !== undefined && s.seed !== expectedSeed) return null;
  if (!isSquad(s.squad)) return null;
  if (typeof s.spinPickIndex !== "number" || !Number.isInteger(s.spinPickIndex) || s.spinPickIndex < 0) {
    return null;
  }
  if (typeof s.respinsRemaining !== "number" || s.respinsRemaining < 0) return null;
  if (!Array.isArray(s.usedTeamYearKeys) || !s.usedTeamYearKeys.every((k) => typeof k === "string")) {
    return null;
  }
  const legendSlot = s.legendSpinSlotIndex;
  if (legendSlot !== null && typeof legendSlot !== "number") return null;
  let pendingSpin: ResumePendingSpin | null = null;
  if (s.pendingSpin !== null && s.pendingSpin !== undefined) {
    const p = s.pendingSpin as Record<string, unknown>;
    if (typeof p.slotIndex !== "number" || !isTarget(p.target)) return null;
    const slot = (s.squad as SquadSlot[]).find((x) => x.slotIndex === p.slotIndex);
    // A landed spin only makes sense on a slot that is still empty.
    if (!slot || slot.player) return null;
    pendingSpin = { slotIndex: p.slotIndex, target: p.target };
  }
  const snapshot: RunResumeSnapshot = {
    v: RUN_RESUME_VERSION,
    modeKey,
    seed: s.seed,
    runId: s.runId,
    startedAt: s.startedAt,
    squad: s.squad as SquadSlot[],
    spinPickIndex: s.spinPickIndex,
    respinsRemaining: s.respinsRemaining,
    usedTeamYearKeys: s.usedTeamYearKeys as string[],
    legendSpinSlotIndex: legendSlot as number | null,
    legendSpinUsed: s.legendSpinUsed === true,
    pendingSpin,
    savedAt: typeof s.savedAt === "string" ? s.savedAt : s.startedAt,
  };
  return snapshotHasProgress(snapshot) ? snapshot : null;
}

export function loadRunResume(modeKey: ResumeModeKey, expectedSeed?: string): RunResumeSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getResumeStorageKey(modeKey));
    if (!raw) return null;
    const parsed = parseRunResumeSnapshot(raw, modeKey, expectedSeed);
    if (!parsed) localStorage.removeItem(getResumeStorageKey(modeKey));
    return parsed;
  } catch {
    return null;
  }
}

export function saveRunResume(snapshot: RunResumeSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    if (!snapshotHasProgress(snapshot)) {
      localStorage.removeItem(getResumeStorageKey(snapshot.modeKey));
      return;
    }
    localStorage.setItem(getResumeStorageKey(snapshot.modeKey), JSON.stringify(snapshot));
  } catch {
    // Storage full / blocked: the run just won't resume.
  }
}

export function clearRunResume(modeKey: ResumeModeKey): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getResumeStorageKey(modeKey));
  } catch {
    // ignore
  }
}
