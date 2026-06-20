/** Must match `--slot-reel-item-h` in globals.css — single source for transform math. */
export const SLOT_REEL_ITEM_HEIGHT_PX = 48;

export const SLOT_REEL_STRIP_COPIES = 5;

/** Build a repeated strip; guarantees `finalValue` exists in the pool. */
export function buildSlotReelPool(items: string[], finalValue: string): string[] {
  if (items.length === 0) return [finalValue];
  if (items.includes(finalValue)) return items;
  return [finalValue, ...items];
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
