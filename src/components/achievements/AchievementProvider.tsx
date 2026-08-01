"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  checkAchievements,
  acknowledgeExistingAchievementPopups,
  markAchievementPopupSeen,
  type AchievementUnlockResult,
} from "@/lib/achievements/achievementEngine";
import type { AchievementCheckContext } from "@/lib/achievements/achievementContext";
import { ACHIEVEMENT_CHECK_EVENT } from "@/lib/achievements/achievementNotify";
import { AchievementUnlockedPopup } from "./AchievementUnlockedPopup";

type AchievementContextValue = {
  notifyAchievements: (ctx?: AchievementCheckContext) => void;
};

const AchievementContext = createContext<AchievementContextValue>({
  notifyAchievements: () => {},
});

const POPUP_DURATION_MS = 5500;

function achievementPopupsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem("manager-show-achievement-popups") !== "0";
  } catch {
    return true;
  }
}

export function useAchievements() {
  return useContext(AchievementContext);
}

export function AchievementProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<AchievementUnlockResult[]>([]);
  const [active, setActive] = useState<AchievementUnlockResult | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedIdsRef = useRef<Set<string>>(new Set());
  const activeIdRef = useRef<string | null>(null);
  const hasSeededUnseenRef = useRef(false);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  const enqueue = useCallback((items: AchievementUnlockResult[]) => {
    if (!achievementPopupsEnabled() || items.length === 0) return;

    const fresh: AchievementUnlockResult[] = [];
    for (const item of items) {
      if (queuedIdsRef.current.has(item.id)) continue;
      if (activeIdRef.current === item.id) continue;
      queuedIdsRef.current.add(item.id);
      fresh.push(item);
    }
    if (fresh.length === 0) return;
    setQueue((prev) => [...prev, ...fresh]);
  }, []);

  const notifyAchievements = useCallback(
    (ctx: AchievementCheckContext = {}) => {
      const unlocked = checkAchievements(ctx);
      enqueue(unlocked);
    },
    [enqueue]
  );

  // Persist acknowledgement for any previously unlocked achievements so
  // login / refresh / mode entry never re-queues historical unlocks.
  // Only locked→unlocked transitions (notifyAchievements) enqueue popups.
  useEffect(() => {
    if (hasSeededUnseenRef.current) return;
    hasSeededUnseenRef.current = true;
    acknowledgeExistingAchievementPopups();
  }, []);

  useEffect(() => {
    const onCheck = (event: Event) => {
      const detail = (event as CustomEvent<AchievementCheckContext>).detail;
      notifyAchievements(detail ?? {});
    };
    window.addEventListener(ACHIEVEMENT_CHECK_EVENT, onCheck);
    return () => window.removeEventListener(ACHIEVEMENT_CHECK_EVENT, onCheck);
  }, [notifyAchievements]);

  // Promote next queued item to active and acknowledge immediately so a
  // mid-popup navigation/remount cannot replay it.
  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    activeIdRef.current = next.id;
    markAchievementPopupSeen(next.id);
    setActive(next);
    setQueue(rest);
  }, [active, queue]);

  // Auto-dismiss timer starts only when a popup is actually active/shown.
  // Cleanup clears the timer only — never marks seen (avoids remount flash).
  useEffect(() => {
    if (!active) return;

    const shownId = active.id;
    activeIdRef.current = shownId;
    clearDismissTimer();

    dismissTimer.current = setTimeout(() => {
      if (activeIdRef.current !== shownId) return;
      markAchievementPopupSeen(shownId);
      queuedIdsRef.current.delete(shownId);
      activeIdRef.current = null;
      setActive(null);
    }, POPUP_DURATION_MS);

    return () => {
      clearDismissTimer();
    };
  }, [active, clearDismissTimer]);

  useEffect(() => {
    return () => {
      clearDismissTimer();
    };
  }, [clearDismissTimer]);

  const dismissActive = useCallback(() => {
    if (!active) return;
    const id = active.id;
    clearDismissTimer();
    markAchievementPopupSeen(id);
    queuedIdsRef.current.delete(id);
    activeIdRef.current = null;
    setActive(null);
  }, [active, clearDismissTimer]);

  return (
    <AchievementContext.Provider value={{ notifyAchievements }}>
      {children}
      {/* Always mount popup shell so AnimatePresence can play exit (avoids flash-cut). */}
      <AchievementUnlockedPopup
        result={active}
        onDismiss={dismissActive}
      />
    </AchievementContext.Provider>
  );
}
