/**
 * Daily pick rarity ("12% picked him"), Immaculate Grid style. Pure helpers: turning the
 * aggregate rows from `get_daily_pick_rarity` into per-slot percentages, the run's rarest pick
 * and the labels. The Supabase calls live in storage/daily-pick-rarity.ts.
 * Tests: scripts/test-social.ts.
 */

/** One row from the aggregate RPC: how many coaches put this card in this slot today. */
export interface PickRarityRow {
  slot: number;
  cardId: string;
  picked: number;
  slotTotal: number;
}

export interface SlotRarity {
  slot: number;
  cardId: string;
  picked: number;
  slotTotal: number;
  /** 0-100. */
  percent: number;
}

/** Below this many picks in a slot the percentage is noise ("100% picked him" from one coach). */
export const PICK_RARITY_MIN_SAMPLE = 3;

/** "0.4%", "<0.1%", "12%", "100%". One decimal under 10%, whole numbers above. */
export function formatPickPercent(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return "0%";
  if (percent >= 100) return "100%";
  if (percent < 0.1) return "<0.1%";
  if (percent < 10) {
    const oneDp = Math.round(percent * 10) / 10;
    return `${oneDp >= 10 ? 10 : oneDp}%`;
  }
  return `${Math.min(99, Math.round(percent))}%`;
}

/**
 * Match the rows to the run's own picks (slot → card id). Rows for other cards, unknown slots,
 * bad numbers and slots under the minimum sample are dropped, so a missing entry means "no data".
 */
export function buildPickRarity(
  rows: readonly PickRarityRow[],
  picks: ReadonlyMap<number, string>,
  minSample = PICK_RARITY_MIN_SAMPLE
): Map<number, SlotRarity> {
  const out = new Map<number, SlotRarity>();
  for (const row of rows) {
    if (!row || picks.get(row.slot) !== row.cardId) continue;
    const picked = Math.max(0, Math.floor(Number(row.picked) || 0));
    const total = Math.max(0, Math.floor(Number(row.slotTotal) || 0));
    if (total < Math.max(1, minSample) || picked > total) continue;
    out.set(row.slot, { slot: row.slot, cardId: row.cardId, picked, slotTotal: total, percent: (picked / total) * 100 });
  }
  return out;
}

/** The least-picked card of the run (ties → the earlier slot). Null when there is no data. */
export function findRarestPick(rarity: ReadonlyMap<number, SlotRarity>): SlotRarity | null {
  let best: SlotRarity | null = null;
  for (const r of [...rarity.values()].sort((a, b) => a.slot - b.slot)) {
    if (!best || r.percent < best.percent) best = r;
  }
  return best;
}

/** "12% picked him". */
export function pickRarityLabel(r: Pick<SlotRarity, "percent">): string {
  return `${formatPickPercent(r.percent)} picked him`;
}

/** Normalise the raw RPC rows (snake_case, numbers as strings from bigint). */
export function parsePickRarityRows(data: unknown): PickRarityRow[] {
  if (!Array.isArray(data)) return [];
  const rows: PickRarityRow[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const slot = Number(r.slot);
    const cardId = typeof r.card_id === "string" ? r.card_id : "";
    if (!Number.isInteger(slot) || !cardId) continue;
    rows.push({ slot, cardId, picked: Number(r.picked) || 0, slotTotal: Number(r.slot_total) || 0 });
  }
  return rows;
}
