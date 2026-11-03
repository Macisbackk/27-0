"use client";

import { useSyncExternalStore } from "react";

/**
 * While a Manager Mode career is on screen (the hub and every full-screen step: the market,
 * Deadline Day, the summer window, departures, the review), the phone bottom bar switches from
 * the site's modes (Home · Classic · Manager · Puzzles · Profile) to the Manager sections
 * (Match · Team · Table · Club). CareerApp registers here; BottomNav reads it.
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

/** The Manager sections, or null when no career is on screen (server render: always null). */
export function useManagerNav(): ManagerNavState | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
}
