"use client";

/**
 * "Hide this coach" (App Review 1.2: block abusive users). A signed-in player can hide a coach from
 * their own view of every leaderboard. Saved on this device and in the account's user_stats row
 * (GLOBAL / hidden_coaches, readable only by its owner), merged like the cosmetics store: union,
 * latest change per coach wins, and a failed cloud read never overwrites either copy.
 */
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import { STORAGE_KEYS } from "./keys";
import {
  emptyHiddenCoaches,
  hiddenCoachIds,
  mergeHiddenCoaches,
  normalizeHiddenCoaches,
  type HiddenCoachesState,
} from "../moderation/hidden-coaches-merge";

export const HIDDEN_COACHES_CHANGED_EVENT = "27-0-hidden-coaches-changed";

const STAT_MODE = "GLOBAL";
const STAT_KEY = "hidden_coaches";

export function getHiddenCoaches(): HiddenCoachesState {
  if (typeof window === "undefined") return emptyHiddenCoaches();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.hiddenCoaches);
    return raw ? normalizeHiddenCoaches(JSON.parse(raw)) : emptyHiddenCoaches();
  } catch {
    return emptyHiddenCoaches();
  }
}

function save(state: HiddenCoachesState, { cloud = true } = {}) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.hiddenCoaches, JSON.stringify(state));
  } catch {
    /* storage full / blocked */
  }
  window.dispatchEvent(new CustomEvent(HIDDEN_COACHES_CHANGED_EVENT));
  if (cloud) void saveCloud(state);
}

function setHidden(userId: string, name: string, hidden: boolean) {
  if (!userId) return;
  const state = getHiddenCoaches();
  const others = state.coaches.filter((c) => c.userId !== userId);
  save(
    normalizeHiddenCoaches({
      coaches: [{ userId, name, hidden, changedAt: new Date().toISOString() }, ...others],
    })
  );
}

export const hideCoach = (userId: string, name: string) => setHidden(userId, name, true);

export function unhideCoach(userId: string) {
  const existing = getHiddenCoaches().coaches.find((c) => c.userId === userId);
  setHidden(userId, existing?.name ?? "Coach", false);
}

/** Coaches currently hidden, newest first (Settings list). */
export function listHiddenCoaches() {
  return getHiddenCoaches().coaches.filter((c) => c.hidden);
}

/** React hook: ids of hidden coaches, re-rendering when the list changes. */
export function useHiddenCoachIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const read = () => setIds(hiddenCoachIds(getHiddenCoaches()));
    read();
    window.addEventListener(HIDDEN_COACHES_CHANGED_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(HIDDEN_COACHES_CHANGED_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return ids;
}

/** React hook: the hidden coaches list (Settings). */
export function useHiddenCoachesList() {
  const [list, setList] = useState<ReturnType<typeof listHiddenCoaches>>([]);
  useEffect(() => {
    const read = () => setList(listHiddenCoaches());
    read();
    window.addEventListener(HIDDEN_COACHES_CHANGED_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(HIDDEN_COACHES_CHANGED_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return list;
}

async function saveCloud(state: HiddenCoachesState) {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  try {
    await supabase.from("user_stats").upsert(
      {
        user_id: userId,
        mode: STAT_MODE,
        stat_key: STAT_KEY,
        stat_value: hiddenCoachIds(state).size,
        stat_json: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,mode,stat_key" }
    );
  } catch {
    /* offline: next change retries */
  }
}

/**
 * On login: union of this device's list and the account's. Rejects (leaving both copies alone)
 * when the cloud read fails, so one bad read can't wipe the account's list.
 */
export async function mergeHiddenCoachesFromCloud(): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  const { data, error } = await supabase
    .from("user_stats")
    .select("stat_json")
    .eq("user_id", userId)
    .eq("mode", STAT_MODE)
    .eq("stat_key", STAT_KEY)
    .maybeSingle();
  if (error) throw error;
  const local = getHiddenCoaches();
  const merged = mergeHiddenCoaches(local, data?.stat_json ?? null);
  const cloudCopy = normalizeHiddenCoaches(data?.stat_json ?? null);
  // Only upload when the device had something the cloud didn't.
  save(merged, { cloud: JSON.stringify(merged) !== JSON.stringify(cloudCopy) });
}
