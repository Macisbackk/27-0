/**
 * Local history of finished seasons (this device only) for the Records page: the squad, record,
 * finish and play-off result of the last runs plus the best ones (see lib/records.ts).
 * Written from storage/run.ts when a season / play-off run is recorded.
 */
import type { SquadSlot } from "../types";
import { getAverageSquadRating, getEffectivePeakRating } from "../squad-analysis";
import { normalizeRunHistory, upsertRunHistory, type RunHistoryEntry, type RunHistoryVariant } from "../records";

export const RUN_HISTORY_KEY = "27-0-run-history";
export const RUN_HISTORY_CHANGED_EVENT = "27-0-run-history-changed";

export function loadRunHistory(): RunHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizeRunHistory(JSON.parse(localStorage.getItem(RUN_HISTORY_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function save(history: RunHistoryEntry[]): void {
  try {
    localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(history));
    window.dispatchEvent(new Event(RUN_HISTORY_CHANGED_EVENT));
  } catch {
    // storage full / blocked: records just won't include this run
  }
}

export function squadToHistoryCards(squad: readonly SquadSlot[]) {
  return squad
    .filter((s) => s.player)
    .map((s) => ({
      slot: s.slotIndex,
      label: s.label,
      id: s.player!.id,
      name: s.player!.name,
      club: s.player!.runClub ?? s.player!.displayClub ?? s.player!.club,
      year: typeof s.player!.year === "number" ? s.player!.year : null,
      rating: Math.round(getEffectivePeakRating(s)),
    }));
}

/** Regular season finished: add the run (idempotent per run id). */
export function recordRunHistorySeason(input: {
  runId: string;
  variant: RunHistoryVariant;
  squad: readonly SquadSlot[];
  wins: number;
  losses: number;
  position: number;
  perfect: boolean;
  winStreak: number;
}): void {
  if (typeof window === "undefined" || !input.runId) return;
  const history = loadRunHistory();
  const existing = history.find((h) => h.id === input.runId);
  const entry: RunHistoryEntry = {
    id: input.runId,
    at: existing?.at ?? Date.now(),
    variant: input.variant,
    wins: input.wins,
    losses: input.losses,
    position: input.position,
    perfect: input.perfect,
    winStreak: input.winStreak,
    playoffWins: existing?.playoffWins ?? 0,
    playoffLosses: existing?.playoffLosses ?? 0,
    finish: existing?.finish ?? (input.position > 6 ? "Missed Play-Offs" : null),
    rating: getAverageSquadRating([...input.squad]),
    squad: squadToHistoryCards(input.squad),
  };
  save(upsertRunHistory(history, entry));
}

/** Play-offs finished: add the result to the run's entry (no-op if the season wasn't recorded). */
export function recordRunHistoryPlayoffs(input: {
  runId: string;
  playoffWins: number;
  playoffLosses: number;
  finish: string | null | undefined;
}): void {
  if (typeof window === "undefined" || !input.runId) return;
  const history = loadRunHistory();
  const existing = history.find((h) => h.id === input.runId);
  if (!existing) return;
  save(
    upsertRunHistory(history, {
      ...existing,
      playoffWins: input.playoffWins,
      playoffLosses: input.playoffLosses,
      finish: input.finish ?? existing.finish,
    })
  );
}
