"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * One reward popup at a time.
 *
 * Blocking sheets (Club Funds earned, login welcome, install prompt) ask for a slot with
 * `useSheetSlot(open)`; only the first sheet in line renders, the rest wait their turn.
 * Non-blocking toasts (achievements, mission rewards) go through `pushToast`; `ToastHost`
 * shows them one after another, and holds them while a sheet is up so nothing stacks.
 */

type Listener = () => void;

/* ------------------------------------------------------------------ sheets */

let sheetQueue: number[] = [];
let nextSheetToken = 1;
const sheetListeners = new Set<Listener>();

function emitSheets() {
  for (const l of sheetListeners) l();
}

function subscribeSheets(listener: Listener) {
  sheetListeners.add(listener);
  return () => {
    sheetListeners.delete(listener);
  };
}

function getSheetFront(): number | null {
  return sheetQueue[0] ?? null;
}

function requestSheet(token: number) {
  if (sheetQueue.includes(token)) return;
  sheetQueue = [...sheetQueue, token];
  emitSheets();
}

function releaseSheet(token: number) {
  if (!sheetQueue.includes(token)) return;
  sheetQueue = sheetQueue.filter((t) => t !== token);
  emitSheets();
}

/** True while any blocking sheet holds (or waits for) the screen. */
export function isSheetActive(): boolean {
  return sheetQueue.length > 0;
}

/**
 * Join the sheet queue while `wantOpen` is true. Returns true when this sheet is at the front
 * and may render. Leaving (wantOpen false or unmount) hands the screen to the next sheet.
 */
export function useSheetSlot(wantOpen: boolean): boolean {
  const tokenRef = useRef<number>(0);
  if (tokenRef.current === 0) tokenRef.current = nextSheetToken++;
  const token = tokenRef.current;

  useEffect(() => {
    if (!wantOpen) {
      releaseSheet(token);
      return;
    }
    requestSheet(token);
    return () => releaseSheet(token);
  }, [wantOpen, token]);

  const front = useSyncExternalStore(subscribeSheets, getSheetFront, () => null);
  return wantOpen && front === token;
}

/** Re-render when sheets come and go (ToastHost waits for an empty queue). */
export function useAnySheetActive(): boolean {
  return useSyncExternalStore(subscribeSheets, isSheetActive, () => false);
}

/* ------------------------------------------------------------------ toasts */

export interface ToastItem {
  id: string;
  /** Small kicker above the title, e.g. "Achievement unlocked". */
  kicker?: string;
  title: string;
  detail?: string;
  /** Club Funds paid with it; shown as "+£15k". */
  amount?: number;
  /** Runs once, when the toast actually appears (e.g. a sound). */
  onShow?: () => void;
}

let toastQueue: ToastItem[] = [];
let toastSeq = 0;
const toastListeners = new Set<Listener>();

function emitToasts() {
  for (const l of toastListeners) l();
}

export function subscribeToasts(listener: Listener) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function getToastQueue(): ToastItem[] {
  return toastQueue;
}

const EMPTY_TOASTS: ToastItem[] = [];
export function getServerToastQueue(): ToastItem[] {
  return EMPTY_TOASTS;
}

/** Queue a non-blocking toast. Returns its id. */
export function pushToast(item: Omit<ToastItem, "id"> & { id?: string }): string {
  const id = item.id ?? `toast-${++toastSeq}`;
  if (toastQueue.some((t) => t.id === id)) return id;
  toastQueue = [...toastQueue, { ...item, id }];
  emitToasts();
  return id;
}

/** Remove a toast (shown long enough, or tapped away). */
export function dismissToast(id: string) {
  if (!toastQueue.some((t) => t.id === id)) return;
  toastQueue = toastQueue.filter((t) => t.id !== id);
  emitToasts();
}
