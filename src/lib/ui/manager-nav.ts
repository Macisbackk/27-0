"use client";

import { useSyncExternalStore } from "react";

/**
 * While the Manager Mode hub is on screen, the phone bottom bar switches from the site's modes
 * (Home · Classic · Manager · Puzzles · Profile) to the hub's sections (Home · Match · Team ·
 * Table · Club). CareerApp registers the hub here; BottomNav reads it.
 */
export type ManagerTab = "match" | "team" | "table" | "club";

interface ManagerNavState {
  tab: ManagerTab;
  setTab: (tab: ManagerTab) => void;
}

let current: ManagerNavState | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Called by the hub on every render where it is showing; `null` when it unmounts. */
export function setManagerNav(next: ManagerNavState | null) {
  if (current === next) return;
  if (current && next && current.tab === next.tab && current.setTab === next.setTab) return;
  current = next;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The hub's sections, or null when the Manager hub isn't showing (server render: always null). */
export function useManagerNav(): ManagerNavState | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
}
