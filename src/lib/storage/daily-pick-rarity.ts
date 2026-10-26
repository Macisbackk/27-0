/**
 * Daily pick rarity: Supabase side. Every signed-in coach's counted Daily attempt records its 13
 * picks (day, slot, card id) through `record_daily_picks`; the review reads per-slot percentages
 * for its own picks through `get_daily_pick_rarity` (aggregate only, never user ids).
 * Migration: supabase/migrations/20261028120000_daily_pick_rarity.sql.
 *
 * Degrades quietly: no Supabase config, the RPCs not deployed yet, offline → no rarity shown.
 */
import { isSupabaseConfigured, supabase } from "../supabase";
import { isLoggedIn } from "../auth-session";
import { parsePickRarityRows, type PickRarityRow } from "../pick-rarity";

export interface DailyPick {
  slot: number;
  cardId: string;
}

let rpcMissing = false;
const pendingRecords = new Map<string, Promise<void>>();
const recordedRuns = new Set<string>();

function isMissingRpc(error: { code?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || error.code === "42P01" || error.code === "PGRST205";
}

function cleanPicks(picks: readonly DailyPick[]): { slot: number; card_id: string }[] {
  return picks
    .filter((p) => Number.isInteger(p.slot) && p.slot >= 0 && p.slot <= 12 && typeof p.cardId === "string" && p.cardId)
    .slice(0, 13)
    .map((p) => ({ slot: p.slot, card_id: p.cardId }));
}

/**
 * Record the counted Daily attempt's picks (signed-in only; the server keeps the first set per
 * coach per day). Fire-and-forget: the review's rarity read waits for it via `pendingRecords`.
 */
export function recordDailyPicks(dayKey: string, runId: string, picks: readonly DailyPick[]): Promise<void> {
  if (!isSupabaseConfigured || rpcMissing || !isLoggedIn()) return Promise.resolve();
  const runKey = `${dayKey}:${runId}`;
  if (recordedRuns.has(runKey)) return pendingRecords.get(dayKey) ?? Promise.resolve();
  recordedRuns.add(runKey);
  const body = cleanPicks(picks);
  if (body.length === 0) return Promise.resolve();
  const flight = (async () => {
    try {
      const { error } = await supabase.rpc("record_daily_picks", {
        p_day_key: dayKey,
        p_run_id: runId,
        p_picks: body,
      });
      if (isMissingRpc(error)) rpcMissing = true;
      else if (error) console.warn("[pick-rarity] record failed:", error.message);
    } catch {
      /* offline: rarity just won't include this run */
    }
  })();
  pendingRecords.set(dayKey, flight);
  return flight;
}

/** Aggregate rows for the given picks on a day. [] when unavailable (no rarity shown). */
export async function fetchDailyPickRarity(dayKey: string, picks: readonly DailyPick[]): Promise<PickRarityRow[]> {
  if (!isSupabaseConfigured || rpcMissing) return [];
  const body = cleanPicks(picks);
  if (body.length === 0) return [];
  await pendingRecords.get(dayKey)?.catch(() => undefined);
  try {
    const { data, error } = await supabase.rpc("get_daily_pick_rarity", {
      p_day_key: dayKey,
      p_picks: body,
    });
    if (error) {
      if (isMissingRpc(error)) rpcMissing = true;
      return [];
    }
    return parsePickRarityRows(data);
  } catch {
    return [];
  }
}
