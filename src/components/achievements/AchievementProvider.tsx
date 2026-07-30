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
  getUnseenAchievementPopups,
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

export function useAchievements() {
  return useContext(AchievementContext);
}

export function AchievementProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<AchievementUnlockResult[]>([]);
  const [active, setActive] = useState<AchievementUnlockResult | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enqueue = useCallback((items: AchievementUnlockResult[]) => {
    if (items.length === 0) return;
    setQueue((prev) => [...prev, ...items]);
  }, []);

  const notifyAchievements = useCallback(
    (ctx: AchievementCheckContext = {}) => {
      const unlocked = checkAchievements(ctx);
      enqueue(unlocked);
    },
    [enqueue]
  );

  useEffect(() => {
    const unseen = getUnseenAchievementPopups();
    enqueue(unseen);
  }, [enqueue]);

  useEffect(() => {
    const onCheck = (event: Event) => {
      const detail = (event as CustomEvent<AchievementCheckContext>).detail;
      notifyAchievements(detail ?? {});
    };
    window.addEventListener(ACHIEVEMENT_CHECK_EVENT, onCheck);
    return () => window.removeEventListener(ACHIEVEMENT_CHECK_EVENT, onCheck);
  }, [notifyAchievements]);

  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setActive(next);
    setQueue(rest);
  }, [active, queue]);

  useEffect(() => {
    if (!active) return;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      markAchievementPopupSeen(active.id);
      setActive(null);
    }, 5500);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [active]);

  const dismissActive = useCallback(() => {
    if (!active) return;
    markAchievementPopupSeen(active.id);
    setActive(null);
  }, [active]);

  return (
    <AchievementContext.Provider value={{ notifyAchievements }}>
      {children}
      {active ? (
        <AchievementUnlockedPopup
          result={active}
          onDismiss={dismissActive}
        />
      ) : null}
    </AchievementContext.Provider>
  );
}
