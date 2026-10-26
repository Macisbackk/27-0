"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { formatClubFunds } from "@/lib/club-funds";
import { uiLayerClass } from "@/lib/ui/layers";
import {
  dismissToast,
  getServerToastQueue,
  getToastQueue,
  subscribeToasts,
  useAnySheetActive,
} from "@/lib/ui/popup-queue";

const SHOW_MS = 4_000;

/**
 * The one place toasts appear: achievements, mission rewards. One at a time, top of the
 * screen, never over a reward sheet (they wait until it closes). They never take taps, so the
 * header and page underneath stay usable while one is up.
 * Mounted once in the root layout.
 */
export function ToastHost() {
  const queue = useSyncExternalStore(subscribeToasts, getToastQueue, getServerToastQueue);
  const sheetUp = useAnySheetActive();
  const current = sheetUp ? null : (queue[0] ?? null);
  const shownRef = useRef<string | null>(null);
  // Mounted in the root layout on every page: render nothing until hydrated, because BodyPortal
  // portals straight away on the client while the server renders nothing (React error #418).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!current) return;
    if (shownRef.current !== current.id) {
      shownRef.current = current.id;
      try {
        current.onShow?.();
      } catch {
        /* a sound failing must not keep the toast up */
      }
    }
    const id = current.id;
    const t = window.setTimeout(() => dismissToast(id), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [current]);

  if (!mounted) return null;
  return (
    <BodyPortal>
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] flex justify-center px-4 ${uiLayerClass("criticalAnimation")}`}
      >
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div
              key={current.id}
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex w-full max-w-md items-center gap-3 rounded-control border border-theme-primary/60 bg-pitch-800 px-3.5 py-2.5 text-left text-sm text-[color:var(--fl-text)] shadow-lg"
            >
              <span className="min-w-0 flex-1">
                {current.kicker ? (
                  <span className="block text-[12px] font-semibold text-theme-primary">{current.kicker}</span>
                ) : null}
                <span className="block font-semibold leading-snug text-white">{current.title}</span>
                {current.detail ? (
                  <span className="block text-[13px] leading-snug text-[color:var(--fl-muted)]">{current.detail}</span>
                ) : null}
              </span>
              {current.amount && current.amount > 0 ? (
                <span className="shrink-0 font-bold tabular-nums text-theme-primary">
                  +{formatClubFunds(current.amount)}
                </span>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </BodyPortal>
  );
}
