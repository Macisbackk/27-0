import { STORAGE_KEYS } from "../storage/keys";
import type { GameBoostId } from "./boostDefinitions";
import { getBoostDefinition } from "./boostDefinitions";
import {
  loadCloudBoostInventory,
  saveCloudBoostInventory,
} from "../storage/boost-inventory-cloud";

export const BOOST_INVENTORY_CHANGED_EVENT = "27-0-boost-inventory-changed";
export const BOOST_INVENTORY_SCHEMA_VERSION = 1;

export type ActiveGameBoostStatus =
  | "selected"
  | "armed"
  | "applied"
  | "consumed"
  | "cancelled"
  | "failed";

export interface BoostPurchaseRecord {
  id: string;
  boostId: GameBoostId;
  quantity: number;
  pricePaid: number;
  purchasedAt: string;
}

export interface BoostUsageRecord {
  id: string;
  boostId: GameBoostId;
  accountId?: string | null;
  gameSaveId: string;
  mode: string;
  targetId?: string;
  status: ActiveGameBoostStatus;
  timestamp: string;
}

export interface ActiveGameBoost {
  id: string;
  boostId: GameBoostId;
  gameSaveId: string;
  mode: string;
  status: ActiveGameBoostStatus;
  targetId?: string;
  armedAt: string;
}

export interface UserBoostInventory {
  quantities: Record<string, number>;
  activeGameBoosts: ActiveGameBoost[];
  purchaseHistory: BoostPurchaseRecord[];
  usageHistory: BoostUsageRecord[];
  schemaVersion: number;
}

function emptyInventory(): UserBoostInventory {
  return {
    quantities: {},
    activeGameBoosts: [],
    purchaseHistory: [],
    usageHistory: [],
    schemaVersion: BOOST_INVENTORY_SCHEMA_VERSION,
  };
}

function normalizeInventory(
  raw: Partial<UserBoostInventory> | null
): UserBoostInventory {
  if (!raw) return emptyInventory();
  return {
    quantities:
      raw.quantities && typeof raw.quantities === "object"
        ? { ...raw.quantities }
        : {},
    activeGameBoosts: Array.isArray(raw.activeGameBoosts)
      ? [...raw.activeGameBoosts]
      : [],
    purchaseHistory: Array.isArray(raw.purchaseHistory)
      ? [...raw.purchaseHistory]
      : [],
    usageHistory: Array.isArray(raw.usageHistory)
      ? [...raw.usageHistory]
      : [],
    schemaVersion: BOOST_INVENTORY_SCHEMA_VERSION,
  };
}

function mergeRecordsById<T extends { id: string }>(
  local: T[],
  cloud: T[]
): T[] {
  const merged = new Map<string, T>();
  for (const record of local) merged.set(record.id, record);
  for (const record of cloud) {
    if (!merged.has(record.id)) merged.set(record.id, record);
  }
  return [...merged.values()];
}

function mergeActiveGameBoosts(
  local: ActiveGameBoost[],
  cloud: ActiveGameBoost[]
): ActiveGameBoost[] {
  const merged = mergeRecordsById(local, cloud);
  return merged.filter(
    (boost) => boost.status === "armed" || boost.status === "selected"
  );
}

function recomputeQuantities(
  purchases: BoostPurchaseRecord[],
  usages: BoostUsageRecord[]
): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const p of purchases) {
    quantities[p.boostId] = (quantities[p.boostId] ?? 0) + p.quantity;
  }
  for (const u of usages) {
    if (u.status === "consumed" || u.status === "applied") {
      quantities[u.boostId] = Math.max(0, (quantities[u.boostId] ?? 0) - 1);
    }
  }
  return quantities;
}

export function loadBoostInventory(): UserBoostInventory {
  if (typeof window === "undefined") return emptyInventory();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.boostInventory);
    if (!raw) return emptyInventory();
    return normalizeInventory(JSON.parse(raw) as Partial<UserBoostInventory>);
  } catch {
    return emptyInventory();
  }
}

function saveBoostInventory(state: UserBoostInventory): void {
  if (typeof window === "undefined") return;
  const next = normalizeInventory(state);
  localStorage.setItem(STORAGE_KEYS.boostInventory, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(BOOST_INVENTORY_CHANGED_EVENT));
  void saveCloudBoostInventory(next);
}

export function getBoostQuantity(boostId: string): number {
  return Math.max(0, loadBoostInventory().quantities[boostId] ?? 0);
}

export function mergeBoostInventoryFromCloud(
  cloud: UserBoostInventory | null
): void {
  if (!cloud) return;

  const local = loadBoostInventory();

  const purchaseHistory = mergeRecordsById(
    local.purchaseHistory,
    cloud.purchaseHistory
  ).slice(-200);

  const usageHistory = mergeRecordsById(
    local.usageHistory,
    cloud.usageHistory
  ).slice(-300);

  const quantities = recomputeQuantities(purchaseHistory, usageHistory);

  const activeGameBoosts = mergeActiveGameBoosts(
    local.activeGameBoosts,
    cloud.activeGameBoosts
  );

  saveBoostInventory({
    quantities,
    purchaseHistory,
    usageHistory,
    activeGameBoosts,
    schemaVersion: BOOST_INVENTORY_SCHEMA_VERSION,
  });
}

export async function refreshBoostInventoryFromCloud(): Promise<void> {
  const cloud = await loadCloudBoostInventory();
  mergeBoostInventoryFromCloud(cloud);
}

export function addBoostToInventory(
  boostId: GameBoostId,
  quantity: number,
  purchase: BoostPurchaseRecord
): UserBoostInventory {
  const state = loadBoostInventory();
  if (state.purchaseHistory.some((p) => p.id === purchase.id)) {
    return state;
  }
  state.purchaseHistory.push(purchase);
  state.quantities[boostId] = (state.quantities[boostId] ?? 0) + quantity;
  saveBoostInventory(state);
  return state;
}

export function tryConsumeBoostFromInventory(
  boostId: GameBoostId,
  usage: BoostUsageRecord
): { success: boolean; inventory: UserBoostInventory; reason?: string } {
  const state = loadBoostInventory();
  if (state.usageHistory.some((u) => u.id === usage.id)) {
    return { success: true, inventory: state };
  }
  const qty = state.quantities[boostId] ?? 0;
  if (qty < 1) {
    return { success: false, inventory: state, reason: "none-owned" };
  }
  if (!getBoostDefinition(boostId)) {
    return { success: false, inventory: state, reason: "unknown-boost" };
  }
  state.quantities[boostId] = qty - 1;
  state.usageHistory.push({ ...usage, status: "consumed" });
  state.activeGameBoosts = state.activeGameBoosts.filter(
    (a) =>
      a.id !== usage.id &&
      !(
        a.boostId === boostId &&
        a.gameSaveId === usage.gameSaveId &&
        (a.status === "armed" || a.status === "selected")
      )
  );
  saveBoostInventory(state);
  return { success: true, inventory: state };
}

export function armBoostForGame(active: ActiveGameBoost): UserBoostInventory {
  const state = loadBoostInventory();
  state.activeGameBoosts = [
    ...state.activeGameBoosts.filter(
      (a) =>
        !(
          a.gameSaveId === active.gameSaveId &&
          a.boostId === active.boostId &&
          (a.status === "armed" || a.status === "selected")
        )
    ),
    active,
  ];
  saveBoostInventory(state);
  return state;
}

export function getArmedBoostsForGame(gameSaveId: string): ActiveGameBoost[] {
  return loadBoostInventory().activeGameBoosts.filter(
    (a) =>
      a.gameSaveId === gameSaveId &&
      (a.status === "armed" || a.status === "selected")
  );
}

export function clearArmedBoost(
  gameSaveId: string,
  boostId: GameBoostId
): void {
  const state = loadBoostInventory();
  state.activeGameBoosts = state.activeGameBoosts.filter(
    (a) => !(a.gameSaveId === gameSaveId && a.boostId === boostId)
  );
  saveBoostInventory(state);
}

export function cancelArmedBoost(usageId: string): void {
  const state = loadBoostInventory();
  state.activeGameBoosts = state.activeGameBoosts.map((a) =>
    a.id === usageId ? { ...a, status: "cancelled" as const } : a
  );
  saveBoostInventory(state);
}
