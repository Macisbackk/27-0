import type { ClubFundsPayoutResult, ClubFundsRunInput } from "../club-funds";
import { computeClubFundsLines } from "../club-funds";
import { STORAGE_KEYS } from "./keys";
import { saveCloudClubFunds } from "./club-funds-cloud";

export const CLUB_FUNDS_CHANGED_EVENT = "27-0-club-funds-changed";

interface ClubFundsState {
  balance: number;
  paidRunIds: string[];
}

const MAX_PAID_RUN_IDS = 200;

function emptyState(): ClubFundsState {
  return { balance: 0, paidRunIds: [] };
}

function loadState(): ClubFundsState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.clubFunds);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ClubFundsState>;
    return {
      balance:
        typeof parsed.balance === "number" && parsed.balance >= 0
          ? parsed.balance
          : 0,
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
    paidRunIds: state.paidRunIds.slice(-MAX_PAID_RUN_IDS),
  };
  localStorage.setItem(STORAGE_KEYS.clubFunds, JSON.stringify(trimmed));
  window.dispatchEvent(new CustomEvent(CLUB_FUNDS_CHANGED_EVENT));
  void saveCloudClubFunds(trimmed);
}

export function getClubFundsBalance(): number {
  return loadState().balance;
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
  state.paidRunIds.push(input.runId);
  saveState(state);

  return {
    runId: input.runId,
    lines,
    total,
    awarded: true,
    newBalance: state.balance,
  };
}
