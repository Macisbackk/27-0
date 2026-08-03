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
  synchronizeAchievementBaseline,
  markAchievementPopupSeen,
  type AchievementUnlockResult,
} from "@/lib/achievements/achievementEngine";
import type { AchievementCheckContext } from "@/lib/achievements/achievementContext";
import { ACHIEVEMENT_CHECK_EVENT } from "@/lib/achievements/achievementNotify";
import { useAuth } from "@/lib/auth-context";
import { AchievementUnlockedPopup } from "./AchievementUnlockedPopup";

type AchievementContextValue = {
  notifyAchievements: (ctx?: AchievementCheckContext) => void;
  isAchievementHydrated: boolean;
};

const AchievementContext = createContext<AchievementContextValue>({
  notifyAchievements: () => {},
  isAchievementHydrated: false,
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
  const { loading: authLoading, user } = useAuth();
  const userId = user?.id ?? null;
  const [queue, setQueue] = useState<AchievementUnlockResult[]>([]);
  const [active, setActive] = useState<AchievementUnlockResult | null>(null);
  const [isAchievementHydrated, setIsAchievementHydrated] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedIdsRef = useRef<Set<string>>(new Set());
  const activeIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const baselineIdsRef = useRef<Set<string>>(new Set());
  const pendingCtxRef = useRef<AchievementCheckContext | null>(null);
  const baselineUserKeyRef = useRef<string | null>(null);

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
      if (baselineIdsRef.current.has(item.id)) continue;
      queuedIdsRef.current.add(item.id);
      fresh.push(item);
    }
    if (fresh.length === 0) return;
    setQueue((prev) => [...prev, ...fresh]);
  }, []);

  const finishHydration = useCallback(
    (ctx: AchievementCheckContext = {}) => {
      const userKey = userId ?? "guest";
      const { unlockedIds } = synchronizeAchievementBaseline(ctx);
      baselineIdsRef.current = new Set(unlockedIds);
      baselineUserKeyRef.current = userKey;
      hydratedRef.current = true;
      setIsAchievementHydrated(true);

      const pending = pendingCtxRef.current;
      pendingCtxRef.current = null;
      if (pending) {
        enqueue(checkAchievements(pending));
      }
    },
    [enqueue, userId]
  );

  const notifyAchievements = useCallback(
    (ctx: AchievementCheckContext = {}) => {
      if (!hydratedRef.current) {
        pendingCtxRef.current = { ...pendingCtxRef.current, ...ctx };
        return;
      }
      const unlocked = checkAchievements(ctx);
      enqueue(unlocked);
    },
    [enqueue]
  );

  // Identity change: block popups until a fresh silent baseline runs.
  useEffect(() => {
    const userKey = userId ?? "guest";
    if (baselineUserKeyRef.current === userKey && hydratedRef.current) {
      return;
    }
    hydratedRef.current = false;
    setIsAchievementHydrated(false);
  }, [userId]);

  // Guest / session-ready baseline once auth has finished its first pass.
  useEffect(() => {
    if (authLoading) return;
    finishHydration();
  }, [authLoading, userId, finishHydration]);

  // Cloud hydrate completes with auth-state-changed — re-baseline silently.
  useEffect(() => {
    const onAuthChanged = () => {
      finishHydration();
    };
    window.addEventListener("auth-state-changed", onAuthChanged);
    return () => window.removeEventListener("auth-state-changed", onAuthChanged);
  }, [finishHydration]);

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
    activeIdRef.current = next.id;
    markAchievementPopupSeen(next.id);
    setActive(next);
    setQueue(rest);
  }, [active, queue]);

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
    <AchievementContext.Provider
      value={{ notifyAchievements, isAchievementHydrated }}
    >
      {children}
      <AchievementUnlockedPopup
        result={active}
        onDismiss={dismissActive}
      />
    </AchievementContext.Provider>
  );
}
