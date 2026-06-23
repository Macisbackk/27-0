/** Must match `--slot-reel-item-h` in globals.css — single source for transform math. */
export const SLOT_REEL_ITEM_HEIGHT_PX = 48;

export const SLOT_REEL_STRIP_COPIES = 8;

export const DEFAULT_SPIN_TICK_COUNT = 42;

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

/** Index in the strip where `finalValue` lands (last copy, centred in viewport). */
export function computeSlotReelFinalIndex(pool: string[], finalValue: string): number {
  const safeIdx = Math.max(0, pool.indexOf(finalValue));
  const copyStart = pool.length * (SLOT_REEL_STRIP_COPIES - 1);
  return copyStart + safeIdx;
}

export function computeSlotReelScrollY(index: number): number {
  return -index * SLOT_REEL_ITEM_HEIGHT_PX;
}

/** Slot-machine tick indices — fast start, smooth deceleration to final strip index. */
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
    const progress = (tick + 1) / tickCount;
    const eased = 1 - Math.pow(1 - progress, 2.85);
    let next = Math.round(startIndex + eased * (finalIndex - startIndex));
    if (progress < 0.72) {
      next = Math.max(prev + 1, next);
    }
    next = Math.min(finalIndex, Math.max(prev + 1, next));
    if (tick === tickCount - 1) next = finalIndex;
    indices.push(next);
    prev = next;
  }

  return indices;
}
