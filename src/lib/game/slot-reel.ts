/** Must match `--slot-reel-item-h` in globals.css — single source for transform math. */
export const SLOT_REEL_ITEM_HEIGHT_PX = 52;

/** Visible rows in the reel window (centre row is the selection line). */
export const SLOT_REEL_VISIBLE_ROWS = 3;

/**
 * Strip repetitions. Higher = longer travel before landing.
 * 5 copies ≈ 3–4 full pool revolutions from start→final.
 */
export const SLOT_REEL_STRIP_COPIES = 5;

/** Total continuous spin duration (ms). */
export const DEFAULT_SPIN_DURATION_MS = 2800;

/** Minimum pool-lengths the strip must travel during a spin. */
export const MIN_SPIN_POOL_LOOPS = 3;

/** @deprecated Prefer continuous duration; kept for callers/tests. */
export const DEFAULT_SPIN_TICK_COUNT = 36;

/** Vertical offset so item `index` sits on the centre selection line. */
export function computeSlotReelScrollY(index: number): number {
  const centreOffset =
    ((SLOT_REEL_VISIBLE_ROWS - 1) / 2) * SLOT_REEL_ITEM_HEIGHT_PX;
  return centreOffset - index * SLOT_REEL_ITEM_HEIGHT_PX;
}

/** Build a repeated strip; guarantees `finalValue` exists in the pool. */
export function buildSlotReelPool(items: string[], finalValue: string): string[] {
  if (items.length === 0) return [finalValue];
  const unique = [...new Set(items)];
  if (!unique.includes(finalValue)) {
    unique.unshift(finalValue);
  }
  return unique;
}

export function buildSlotReelStrip(pool: string[]): string[] {
  if (pool.length === 0) return [""];
  return Array.from({ length: SLOT_REEL_STRIP_COPIES }, () => pool).flat();
}

/** Index in the strip where `finalValue` lands (last copy). */
export function computeSlotReelFinalIndex(
  pool: string[],
  finalValue: string
): number {
  const safeIdx = Math.max(0, pool.indexOf(finalValue));
  const copyStart = pool.length * (SLOT_REEL_STRIP_COPIES - 1);
  return copyStart + safeIdx;
}

/** Start near the top of the second copy so the first frame already has motion room. */
export function computeSlotReelStartIndex(pool: string[]): number {
  if (pool.length === 0) return 0;
  return Math.min(pool.length, Math.max(1, Math.floor(pool.length * 0.35)));
}

/** Eased progress 0→1 — fast blur of items, long landing decelerate. */
export function easeSlotReelProgress(linear: number): number {
  if (linear <= 0) return 0;
  if (linear >= 1) return 1;
  // Quartic ease-out: hangs in the slowdown so the land feels intentional.
  return 1 - Math.pow(1 - linear, 4);
}

/**
 * Ensure the final index is far enough from start for a satisfying spin.
 * Uses extra virtual loops by landing deeper in the strip when possible.
 */
export function ensureMinimumSpinTravel(
  poolLength: number,
  startIndex: number,
  finalIndex: number
): number {
  if (poolLength <= 0) return finalIndex;
  const minTravel = poolLength * MIN_SPIN_POOL_LOOPS;
  const travel = finalIndex - startIndex;
  if (travel >= minTravel) return finalIndex;
  // Nudge toward a later copy of the same item if strip allows.
  const itemOffset = finalIndex % poolLength;
  const neededCopy = Math.ceil((startIndex + minTravel - itemOffset) / poolLength);
  const maxCopy = SLOT_REEL_STRIP_COPIES - 1;
  const copy = Math.min(maxCopy, Math.max(0, neededCopy));
  return copy * poolLength + itemOffset;
}

/** Slot-machine tick indices — lands exactly on final index. */
export function buildSpinReelTickIndices(
  pool: string[],
  finalValue: string,
  tickCount: number,
  forcedFinalIndex?: number
): number[] {
  if (pool.length === 0) return Array.from({ length: tickCount }, () => 0);
  const startIndex = computeSlotReelStartIndex(pool);
  let finalIndex =
    forcedFinalIndex ?? computeSlotReelFinalIndex(pool, finalValue);
  if (forcedFinalIndex == null) {
    finalIndex = ensureMinimumSpinTravel(pool.length, startIndex, finalIndex);
  }
  const indices: number[] = [];
  let prev = startIndex;

  for (let tick = 0; tick < tickCount; tick++) {
    const linear = (tick + 1) / tickCount;
    const eased = easeSlotReelProgress(linear);
    let next = Math.round(startIndex + eased * (finalIndex - startIndex));
    if (linear < 0.82) {
      next = Math.max(prev + 1, next);
    }
    next = Math.min(finalIndex, Math.max(prev + 1, next));
    if (tick === tickCount - 1) next = finalIndex;
    indices.push(next);
    prev = next;
  }

  return indices;
}

/** Per-tick delay (ms) — fast start, natural slowdown. */
export function buildSpinReelDelaysMs(tickCount: number): number[] {
  return Array.from({ length: tickCount }, (_, i) => {
    const progress = i / tickCount;
    if (progress < 0.2) return 10 + Math.floor(progress * 20);
    if (progress < 0.45) return 18 + Math.floor((progress - 0.2) * 40);
    if (progress < 0.7) return 32 + Math.floor((progress - 0.45) * 80);
    return 55 + Math.floor((progress - 0.7) * 280);
  });
}

export interface SpinReelPlan {
  strip: string[];
  poolLength: number;
  startIndex: number;
  tickIndices: number[];
  finalIndex: number;
  delaysMs: number[];
  durationMs: number;
  /** Stable selected value the animation is guaranteed to land on. */
  finalValue: string;
}

/** Precompute reel animation plan once before spin starts. */
export function buildSpinReelPlan(
  poolItems: string[],
  finalValue: string,
  tickCount = DEFAULT_SPIN_TICK_COUNT,
  durationMs = DEFAULT_SPIN_DURATION_MS
): SpinReelPlan {
  const pool = buildSlotReelPool(poolItems, finalValue);
  const startIndex = computeSlotReelStartIndex(pool);
  let finalIndex = computeSlotReelFinalIndex(pool, finalValue);
  finalIndex = ensureMinimumSpinTravel(pool.length, startIndex, finalIndex);
  return {
    strip: buildSlotReelStrip(pool),
    poolLength: pool.length,
    startIndex,
    tickIndices: buildSpinReelTickIndices(
      pool,
      finalValue,
      tickCount,
      finalIndex
    ),
    finalIndex,
    delaysMs: buildSpinReelDelaysMs(tickCount),
    durationMs,
    finalValue,
  };
}
