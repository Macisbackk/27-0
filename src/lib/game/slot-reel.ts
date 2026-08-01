/** Must match `--slot-reel-item-h` in globals.css — single source for transform math. */
export const SLOT_REEL_ITEM_HEIGHT_PX = 52;

/** Visible rows in the reel window (centre row is the selection line). */
export const SLOT_REEL_VISIBLE_ROWS = 3;

/** Strip repetitions — keep minimal for DOM performance. */
export const SLOT_REEL_STRIP_COPIES = 3;

export const DEFAULT_SPIN_TICK_COUNT = 24;

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
export function computeSlotReelFinalIndex(pool: string[], finalValue: string): number {
  const safeIdx = Math.max(0, pool.indexOf(finalValue));
  const copyStart = pool.length * (SLOT_REEL_STRIP_COPIES - 1);
  return copyStart + safeIdx;
}

/** Eased progress 0→1 with fast start and long deceleration tail. */
export function easeSlotReelProgress(linear: number): number {
  if (linear <= 0) return 0;
  if (linear >= 1) return 1;
  return 1 - Math.pow(1 - linear, 3.6);
}

/** Slot-machine tick indices — lands exactly on final index. */
export function buildSpinReelTickIndices(
  pool: string[],
  finalValue: string,
  tickCount: number
): number[] {
  if (pool.length === 0) return Array.from({ length: tickCount }, () => 0);
  const finalIndex = computeSlotReelFinalIndex(pool, finalValue);
  const startIndex = pool.length;
  const indices: number[] = [];
  let prev = startIndex;

  for (let tick = 0; tick < tickCount; tick++) {
    const linear = (tick + 1) / tickCount;
    const eased = easeSlotReelProgress(linear);
    let next = Math.round(startIndex + eased * (finalIndex - startIndex));
    if (linear < 0.78) {
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
    if (progress < 0.22) return 12 + Math.floor(progress * 28);
    if (progress < 0.5) return 22 + Math.floor((progress - 0.22) * 55);
    if (progress < 0.75) return 42 + Math.floor((progress - 0.5) * 90);
    return 70 + Math.floor((progress - 0.75) * 260);
  });
}

export interface SpinReelPlan {
  strip: string[];
  tickIndices: number[];
  finalIndex: number;
  delaysMs: number[];
  /** Stable selected value the animation is guaranteed to land on. */
  finalValue: string;
}

/** Precompute reel animation plan once before spin starts. */
export function buildSpinReelPlan(
  poolItems: string[],
  finalValue: string,
  tickCount = DEFAULT_SPIN_TICK_COUNT
): SpinReelPlan {
  const pool = buildSlotReelPool(poolItems, finalValue);
  return {
    strip: buildSlotReelStrip(pool),
    tickIndices: buildSpinReelTickIndices(pool, finalValue, tickCount),
    finalIndex: computeSlotReelFinalIndex(pool, finalValue),
    delaysMs: buildSpinReelDelaysMs(tickCount),
    finalValue,
  };
}
