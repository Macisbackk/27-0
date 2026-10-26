/**
 * Daily welcome bonus: open the game on consecutive UK days and the bonus grows, day 1 £10k up to
 * day 7+ £50k. Paid once per UK day through the Club Funds ledger (so it pays once per account,
 * even across devices once the ledger syncs). Miss a day and it starts again at day 1.
 */
import { awardClubFundsLines, getPaidRunIds } from "./storage/club-funds";
import type { ClubFundsPayoutResult } from "./club-funds";
import { getLocalDateKey } from "./mini-games/date";

const KEY = "27-0-daily-bonus";
export const DAILY_BONUS_LADDER = [10_000, 15_000, 20_000, 25_000, 30_000, 40_000, 50_000] as const;

export interface DailyBonusState {
  /** Consecutive UK days the game was opened (today counted once claimed). */
  day: number;
  lastClaimedDateKey: string | null;
}

function dayKeyMinus(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y!, m! - 1, d!));
  utc.setUTCDate(utc.getUTCDate() - days);
  return utc.toISOString().slice(0, 10);
}

export function loadDailyBonus(): DailyBonusState {
  if (typeof window === "undefined") return { day: 0, lastClaimedDateKey: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { day: 0, lastClaimedDateKey: null };
    const p = JSON.parse(raw) as Partial<DailyBonusState>;
    return {
      day: typeof p.day === "number" && p.day >= 0 ? Math.floor(p.day) : 0,
      lastClaimedDateKey: typeof p.lastClaimedDateKey === "string" ? p.lastClaimedDateKey : null,
    };
  } catch {
    return { day: 0, lastClaimedDateKey: null };
  }
}

function save(state: DailyBonusState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the ledger still stops a double pay */
  }
}

export function dailyBonusAmount(day: number): number {
  return DAILY_BONUS_LADDER[Math.max(0, Math.min(DAILY_BONUS_LADDER.length - 1, day - 1))]!;
}

export const dailyBonusRunId = (dateKey: string) => `daily-bonus:${dateKey}`;

/** Already paid today (this device, or another device whose ledger has synced). */
export function dailyBonusClaimedToday(date = new Date()): boolean {
  return getPaidRunIds().includes(dailyBonusRunId(getLocalDateKey(date)));
}

/**
 * What the streak becomes if `today` is claimed. The paid ledger (which syncs with the account)
 * is the source of truth: count the unbroken run of paid days ending yesterday. The on-device
 * state only extends that count past the ledger's 45-day memory, and only when it agrees that
 * yesterday was claimed. Without the ledger count a second device (or cleared site data) reset
 * the streak to day 1 even though yesterday's bonus was paid on the account.
 */
export function nextDailyBonusDay(
  today: string,
  paidRunIds: readonly string[],
  state: DailyBonusState = { day: 0, lastClaimedDateKey: null }
): number {
  const paid = new Set(paidRunIds);
  let ledgerRun = 0;
  while (ledgerRun < 400 && paid.has(dailyBonusRunId(dayKeyMinus(today, ledgerRun + 1)))) ledgerRun++;
  if (ledgerRun === 0) return 1;
  const localRun = state.lastClaimedDateKey === dayKeyMinus(today, 1) ? state.day : 0;
  return Math.max(ledgerRun, localRun) + 1;
}

/**
 * Claim today's bonus if it hasn't been paid. Returns the payout (null when nothing was due).
 * `day` is what the streak becomes: yesterday claimed → +1, otherwise back to 1.
 */
export function claimDailyBonus(date = new Date()): { payout: ClubFundsPayoutResult; day: number } | null {
  if (typeof window === "undefined") return null;
  const today = getLocalDateKey(date);
  const runId = dailyBonusRunId(today);
  if (getPaidRunIds().includes(runId)) return null;
  const day = nextDailyBonusDay(today, getPaidRunIds(), loadDailyBonus());
  const amount = dailyBonusAmount(day);
  const payout = awardClubFundsLines(runId, [
    { id: "daily-bonus", label: day >= 7 ? `Day ${day} in a row · max bonus` : `Day ${day} in a row`, amount },
  ]);
  if (!payout.awarded) return null;
  save({ day, lastClaimedDateKey: today });
  return { payout, day };
}

/** Milliseconds until the next UK midnight (when the Daily and the bonus reset). */
export function msUntilUkMidnight(now = new Date()): number {
  const key = getLocalDateKey(now);
  // Binary search for the instant London's date key flips (handles BST/GMT without a tz library).
  let lo = now.getTime();
  let hi = lo + 26 * 60 * 60 * 1000;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (getLocalDateKey(new Date(mid)) === key) lo = mid;
    else hi = mid;
  }
  return hi - now.getTime();
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const mins = total % 60;
  if (h >= 1) return `${h}h ${String(mins).padStart(2, "0")}m`;
  return `${mins}m`;
}
