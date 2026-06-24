import {
  DEFAULT_UI_THEME_ID,
  UI_THEME_PURCHASE_PRICE,
  getUiThemeById,
  isDefaultUiTheme,
} from "../ui-themes";
import { STORAGE_KEYS } from "./keys";
import { getClubFundsBalance, spendClubFunds } from "./club-funds";
import { loadCloudUiThemeStore, saveCloudUiThemeStore } from "./ui-theme-store-cloud";

export const UI_THEME_CHANGED_EVENT = "27-0-ui-theme-changed";

export interface UiThemeStoreState {
  selectedThemeId: string;
  unlockedThemeIds: string[];
  purchaseIds: string[];
}

function emptyState(): UiThemeStoreState {
  return {
    selectedThemeId: DEFAULT_UI_THEME_ID,
    unlockedThemeIds: [DEFAULT_UI_THEME_ID],
    purchaseIds: [],
  };
}

function normalizeState(raw: Partial<UiThemeStoreState> | null): UiThemeStoreState {
  const base = emptyState();
  if (!raw) return base;

  const unlocked = new Set<string>([DEFAULT_UI_THEME_ID]);
  if (Array.isArray(raw.unlockedThemeIds)) {
    for (const id of raw.unlockedThemeIds) {
      if (typeof id === "string" && id.trim()) unlocked.add(id);
    }
  }

  const selected =
    typeof raw.selectedThemeId === "string" && raw.selectedThemeId.trim()
      ? raw.selectedThemeId
      : DEFAULT_UI_THEME_ID;

  return {
    selectedThemeId: unlocked.has(selected) ? selected : DEFAULT_UI_THEME_ID,
    unlockedThemeIds: [...unlocked],
    purchaseIds: Array.isArray(raw.purchaseIds)
      ? raw.purchaseIds.filter((id) => typeof id === "string")
      : [],
  };
}

function loadState(): UiThemeStoreState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.uiThemeStore);
    if (!raw) return emptyState();
    return normalizeState(JSON.parse(raw) as Partial<UiThemeStoreState>);
  } catch {
    return emptyState();
  }
}

function saveState(state: UiThemeStoreState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.uiThemeStore, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(UI_THEME_CHANGED_EVENT));
  void saveCloudUiThemeStore(state);
}

export function getUiThemeStoreState(): UiThemeStoreState {
  return loadState();
}

export function getSelectedUiThemeId(): string {
  return loadState().selectedThemeId;
}

export function isUiThemeUnlocked(themeId: string): boolean {
  if (isDefaultUiTheme(themeId)) return true;
  return loadState().unlockedThemeIds.includes(themeId);
}

export function selectUiTheme(themeId: string): boolean {
  const state = loadState();
  if (!isUiThemeUnlocked(themeId)) return false;
  if (!getUiThemeById(themeId)) return false;
  state.selectedThemeId = themeId;
  saveState(state);
  return true;
}

export interface UiThemePurchaseResult {
  success: boolean;
  reason?: "insufficient" | "already_unlocked" | "invalid";
  newBalance: number;
}

export function purchaseUiTheme(themeId: string): UiThemePurchaseResult {
  if (isDefaultUiTheme(themeId) || !getUiThemeById(themeId)) {
    return { success: false, reason: "invalid", newBalance: getClubFundsBalance() };
  }

  const state = loadState();
  if (state.unlockedThemeIds.includes(themeId)) {
    return { success: false, reason: "already_unlocked", newBalance: getClubFundsBalance() };
  }

  const purchaseId = `theme-${themeId}`;
  if (state.purchaseIds.includes(purchaseId)) {
    state.unlockedThemeIds = [...new Set([...state.unlockedThemeIds, themeId])];
    saveState(state);
    return { success: true, newBalance: getClubFundsBalance() };
  }

  const spend = spendClubFunds(UI_THEME_PURCHASE_PRICE, purchaseId);
  if (!spend.success) {
    return {
      success: false,
      reason: "insufficient",
      newBalance: spend.newBalance,
    };
  }

  state.unlockedThemeIds = [...new Set([...state.unlockedThemeIds, themeId])];
  state.purchaseIds = [...state.purchaseIds, purchaseId];
  state.selectedThemeId = themeId;
  saveState(state);

  return { success: true, newBalance: spend.newBalance };
}

export async function mergeUiThemeStoreFromCloud(): Promise<void> {
  const cloud = await loadCloudUiThemeStore();
  if (!cloud) return;

  const local = loadState();
  const unlocked = new Set([
    ...local.unlockedThemeIds,
    ...cloud.unlockedThemeIds,
    DEFAULT_UI_THEME_ID,
  ]);
  const purchaseIds = new Set([...local.purchaseIds, ...cloud.purchaseIds]);
  const selected = unlocked.has(cloud.selectedThemeId)
    ? cloud.selectedThemeId
    : local.selectedThemeId;

  saveState({
    selectedThemeId: unlocked.has(selected) ? selected : DEFAULT_UI_THEME_ID,
    unlockedThemeIds: [...unlocked],
    purchaseIds: [...purchaseIds],
  });
}
