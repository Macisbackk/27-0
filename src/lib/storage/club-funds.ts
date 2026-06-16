import type { ClubFundsPayoutResult, ClubFundsRunInput } from "../club-funds";
import { computeClubFundsLines } from "../club-funds";
import { STORAGE_KEYS } from "./keys";
import { saveCloudClubFunds } from "./club-funds-cloud";
import { syncClubFundsLeaderboard } from "./club-funds-leaderboard";

export const CLUB_FUNDS_CHANGED_EVENT = "27-0-club-funds-changed";

export interface ClubFundsState {
  balance: number;
  totalEarned: number;
  paidRunIds: string[];
}

const MAX_PAID_RUN_IDS = 200;

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
    const totalEarned =
      typeof parsed.totalEarned === "number" && parsed.totalEarned >= 0
        ? parsed.totalEarned
        : balance;
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

function saveState(state: ClubFundsState): void {
  if (typeof window === "undefined") return;
  const trimmed: ClubFundsState = {
    balance: state.balance,
    totalEarned: state.totalEarned,
    paidRunIds: state.paidRunIds.slice(-MAX_PAID_RUN_IDS),
  };
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

export function setClubFundsBalance(balance: number): void {
  const state = loadState();
  state.balance = Math.max(0, balance);
  saveState(state);
}

export function mergeClubFundsFromCloud(cloud: ClubFundsState | null): void {
  if (!cloud) return;
  const local = loadState();
  const paidSet = new Set([...local.paidRunIds, ...cloud.paidRunIds]);
  const merged: ClubFundsState = {
    balance: Math.max(local.balance, cloud.balance),
    totalEarned: Math.max(local.totalEarned, cloud.totalEarned ?? cloud.balance),
    paidRunIds: [...paidSet].slice(-MAX_PAID_RUN_IDS),
  };
  saveState(merged);
}

export function awardClubFundsForRun(
  input: ClubFundsRunInput
): ClubFundsPayoutResult {
  const state = loadState();
  const lines = computeClubFundsLines(input);
  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  if (state.paidRunIds.includes(input.runId) || total <= 0) {
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
  state.paidRunIds.push(input.runId);
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
