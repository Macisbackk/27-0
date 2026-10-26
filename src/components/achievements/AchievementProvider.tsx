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
  markAchievementPopupAcknowledged,
  type AchievementUnlockResult,
} from "@/lib/achievements/achievementEngine";
import {
  isAchievementPopupAcknowledged,
} from "@/lib/achievements/achievementStorage";
import type { AchievementCheckContext } from "@/lib/achievements/achievementContext";
import { ACHIEVEMENT_CHECK_EVENT } from "@/lib/achievements/achievementNotify";
import { useAuth } from "@/lib/auth-context";
import { playAchievementUnlock } from "@/lib/sound";
import { pushToast } from "@/lib/ui/popup-queue";

type AchievementContextValue = {
  notifyAchievements: (ctx?: AchievementCheckContext) => void;
  isAchievementHydrated: boolean;
};

const AchievementContext = createContext<AchievementContextValue>({
  notifyAchievements: () => {},
  isAchievementHydrated: false,
});

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
  const [isAchievementHydrated, setIsAchievementHydrated] = useState(false);
  const queuedIdsRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);
  /** Ledger IDs that must never requeue (unlocked + acknowledged, or baseline). */
  const acknowledgedIdsRef = useRef<Set<string>>(new Set());
  const pendingCtxRef = useRef<AchievementCheckContext | null>(null);
  const baselineUserKeyRef = useRef<string | null>(null);

  const enqueue = useCallback((items: AchievementUnlockResult[]) => {
    if (items.length === 0) return;

    if (!achievementPopupsEnabled()) {
      for (const item of items) {
        markAchievementPopupAcknowledged(item.id);
        acknowledgedIdsRef.current.add(item.id);
      }
      return;
    }

    const fresh: AchievementUnlockResult[] = [];
    for (const item of items) {
      if (queuedIdsRef.current.has(item.id)) continue;
      if (acknowledgedIdsRef.current.has(item.id)) continue;
      if (isAchievementPopupAcknowledged(item.id)) {
        acknowledgedIdsRef.current.add(item.id);
        continue;
      }
      queuedIdsRef.current.add(item.id);
      fresh.push(item);
    }
    if (fresh.length === 0) return;
    setQueue((prev) => [...prev, ...fresh]);
  }, []);

  const finishHydration = useCallback(
    (ctx: AchievementCheckContext = {}) => {
      const userKey = userId ?? "guest";
      // Baseline from ledger (+ silent progress import). Never queue historical unlocks.
      const { acknowledgedIds } = synchronizeAchievementBaseline(ctx);
      acknowledgedIdsRef.current = new Set(acknowledgedIds);
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
    if (baselineUserKeyRef.current !== null && baselineUserKeyRef.current !== userKey) {
      hydratedRef.current = false;
      setIsAchievementHydrated(false);
    }
  }, [userId]);

  // Guest / session-ready baseline once auth has finished its first pass.
  useEffect(() => {
    if (authLoading) return;
    const userKey = userId ?? "guest";
    if (baselineUserKeyRef.current === userKey && hydratedRef.current) {
      return;
    }
    finishHydration();
  }, [authLoading, userId, finishHydration]);

  // Cloud/stats hydrate: re-baseline from ledger + progress without flipping
  // hydrated false (avoids full-tree flicker / popup replay).
  useEffect(() => {
    const onAuthChanged = () => {
      if (!hydratedRef.current) {
        finishHydration();
        return;
      }
      const { acknowledgedIds } = synchronizeAchievementBaseline({});
      acknowledgedIdsRef.current = new Set(acknowledgedIds);
      // Never requeue after acknowledge — drop any queued ids now in ledger ack set.
      setQueue((prev) =>
        prev.filter((item) => !acknowledgedIdsRef.current.has(item.id))
      );
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

  // Hand each unlock to the global toast queue (non-blocking; ToastHost shows them one at a
  // time and holds them while a reward sheet is open). Persist the ack first so a remount or
  // hydrate can never requeue this unlock.
  useEffect(() => {
    if (queue.length === 0) return;
    for (const next of queue) {
      queuedIdsRef.current.delete(next.id);
      if (
        acknowledgedIdsRef.current.has(next.id) ||
        isAchievementPopupAcknowledged(next.id)
      ) {
        acknowledgedIdsRef.current.add(next.id);
        continue;
      }
      markAchievementPopupAcknowledged(next.id);
      acknowledgedIdsRef.current.add(next.id);
      pushToast({
        id: `achievement-${next.unlockEventId || next.id}`,
        kicker: "Achievement unlocked",
        title: next.definition.name,
        detail: next.definition.description,
        amount: next.rewardAmount && next.rewardAmount > 0 ? next.rewardAmount : undefined,
        onShow: playAchievementUnlock,
      });
    }
    setQueue([]);
  }, [queue]);

  return (
    <AchievementContext.Provider
      value={{ notifyAchievements, isAchievementHydrated }}
    >
      {children}
    </AchievementContext.Provider>
  );
}
