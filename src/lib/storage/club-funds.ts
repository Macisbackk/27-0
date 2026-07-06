import type {
  ClubFundsEarnedLine,
  ClubFundsPayoutResult,
  ClubFundsRunInput,
} from "../club-funds";
import { computeClubFundsLines } from "../club-funds";
import { STORAGE_KEYS } from "./keys";
import { loadCloudClubFunds, saveCloudClubFunds } from "./club-funds-cloud";
import { syncClubFundsLeaderboard } from "./club-funds-leaderboard";

export const CLUB_FUNDS_CHANGED_EVENT = "27-0-club-funds-changed";

export interface ClubFundsState {
  balance: number;
  totalEarned: number;
  paidRunIds: string[];
}

const MAX_PAID_RUN_IDS = 200;
const pendingSpendIds = new Set<string>();

function emptyState(): ClubFundsState {
  return { balance: 0, totalEarned: 0, paidRunIds: [] };
}

function loadState(): ClubFundsState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.clubFunds);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ClubFundsState>;
    const balance =
      typeof parsed.balance === "number" && parsed.balance >= 0
        ? parsed.balance
        : 0;
    const totalEarnedRaw =
      typeof parsed.totalEarned === "number" && parsed.totalEarned >= 0
        ? parsed.totalEarned
        : balance;
    const totalEarned = Math.max(totalEarnedRaw, balance);
    return {
      balance,
      totalEarned,
      paidRunIds: Array.isArray(parsed.paidRunIds)
        ? parsed.paidRunIds.filter((id) => typeof id === "string")
        : [],
    };
  } catch {
    return emptyState();
  }
}

function clubFundsEqual(a: ClubFundsState, b: ClubFundsState): boolean {
  if (a.balance !== b.balance || a.totalEarned !== b.totalEarned) return false;
  if (a.paidRunIds.length !== b.paidRunIds.length) return false;
  const idsA = [...a.paidRunIds].sort().join("\0");
  const idsB = [...b.paidRunIds].sort().join("\0");
  return idsA === idsB;
}

function saveState(state: ClubFundsState): void {
  if (typeof window === "undefined") return;
  const trimmed: ClubFundsState = {
    balance: state.balance,
    totalEarned: state.totalEarned,
    paidRunIds: state.paidRunIds.slice(-MAX_PAID_RUN_IDS),
  };
  const current = loadState();
  if (clubFundsEqual(current, trimmed)) return;
  localStorage.setItem(STORAGE_KEYS.clubFunds, JSON.stringify(trimmed));
  window.dispatchEvent(new CustomEvent(CLUB_FUNDS_CHANGED_EVENT));
  void saveCloudClubFunds(trimmed);
}

export function getClubFundsBalance(): number {
  return loadState().balance;
}

export function getClubFundsTotalEarned(): number {
  return loadState().totalEarned;
}

/** Sync leaderboard after load/backfill so existing balances appear on the board. */
export function syncClubFundsLeaderboardOnLoad(): void {
  const state = loadState();
  if (state.totalEarned > 0) {
    syncClubFundsLeaderboard(state.totalEarned);
  }
}

export function setClubFundsBalance(balance: number): void {
  const state = loadState();
  state.balance = Math.max(0, balance);
  saveState(state);
}

export function mergeClubFundsFromCloud(cloud: ClubFundsState | null): void {
  if (!cloud) return;
  const local = loadState();
  const paidSet = new Set([...local.paidRunIds, ...cloud.paidRunIds]);
  const localExclusiveIds = local.paidRunIds.filter(
    (id) => !cloud.paidRunIds.includes(id)
  );
  const cloudExclusiveIds = cloud.paidRunIds.filter(
    (id) => !local.paidRunIds.includes(id)
  );
  const totalEarned = Math.max(
    local.totalEarned,
    cloud.totalEarned ?? cloud.balance
  );

  const isStorePurchaseId = (id: string) => id.startsWith("theme-");
  const localHasUnsyncedStoreSpend = localExclusiveIds.some(isStorePurchaseId);
  const cloudHasStoreSpend = cloudExclusiveIds.some(isStorePurchaseId);

  let balance: number;
  if (localHasUnsyncedStoreSpend) {
    // Local store spend not yet on cloud — never restore a higher stale cloud balance.
    balance = local.balance;
  } else if (cloudHasStoreSpend && cloud.balance < local.balance) {
    // Cloud recorded a store purchase this device has not applied yet.
    balance = cloud.balance;
  } else {
    // Earnings may exist on either device — keep the higher spendable balance.
    balance = Math.max(local.balance, cloud.balance);
  }

  balance = Math.max(0, Math.min(balance, totalEarned));

  const merged: ClubFundsState = {
    balance,
    totalEarned,
    paidRunIds: [...paidSet].slice(-MAX_PAID_RUN_IDS),
  };
  saveState(merged);
  syncClubFundsLeaderboard(merged.totalEarned);
}

/** Pull latest Club Funds from the logged-in account and merge into local storage. */
export async function refreshClubFundsFromCloud(): Promise<void> {
  const cloud = await loadCloudClubFunds();
  mergeClubFundsFromCloud(cloud);
}

/** Best-effort push before the tab closes (mobile browsers). */
export function flushClubFundsToCloud(): void {
  if (typeof window === "undefined") return;
  void saveCloudClubFunds(loadState());
}

export interface SpendClubFundsResult {
  success: boolean;
  newBalance: number;
}

/** Deduct club funds for store purchases — does not reduce lifetime earned. */
export function spendClubFunds(
  amount: number,
  purchaseId: string
): SpendClubFundsResult {
  const state = loadState();
  if (amount <= 0 || state.balance < amount) {
    return { success: false, newBalance: state.balance };
  }
  if (state.paidRunIds.includes(purchaseId)) {
    return { success: true, newBalance: state.balance };
  }
  if (pendingSpendIds.has(purchaseId)) {
    return { success: false, newBalance: state.balance };
  }

  pendingSpendIds.add(purchaseId);
  try {
    state.balance = Math.max(0, state.balance - amount);
    state.paidRunIds.push(purchaseId);
    saveState(state);
    return { success: true, newBalance: state.balance };
  } finally {
    pendingSpendIds.delete(purchaseId);
  }
}

export function awardClubFundsForRun(
  input: ClubFundsRunInput
): ClubFundsPayoutResult {
  const state = loadState();
  const lines = computeClubFundsLines(input);
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const payoutRunId = input.fundsPhase
    ? `${input.runId}-${input.fundsPhase}`
    : input.runId;

  if (state.paidRunIds.includes(payoutRunId) || total <= 0) {
    return {
      runId: input.runId,
      lines,
      total,
      awarded: false,
      newBalance: state.balance,
    };
  }

  state.balance += total;
  state.totalEarned += total;
  state.paidRunIds.push(payoutRunId);
  saveState(state);
  syncClubFundsLeaderboard(state.totalEarned);

  return {
    runId: input.runId,
    lines,
    total,
    awarded: true,
    newBalance: state.balance,
  };
}

/** Award explicit Club Funds lines (e.g. Manager Mode season rewards). */
export function awardClubFundsLines(
  runId: string,
  lines: ClubFundsEarnedLine[]
): ClubFundsPayoutResult {
  const state = loadState();
  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  if (state.paidRunIds.includes(runId) || total <= 0) {
    return {
      runId,
      lines,
      total,
      awarded: false,
      newBalance: state.balance,
    };
  }

  state.balance += total;
  state.totalEarned += total;
  state.paidRunIds.push(runId);
  saveState(state);
  syncClubFundsLeaderboard(state.totalEarned);

  return {
    runId,
    lines,
    total,
    awarded: true,
    newBalance: state.balance,
  };
}
