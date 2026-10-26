"use client";

import { useEffect } from "react";
import {
  DAILY_MISSIONS_CHANGED_EVENT,
  type DailyMissionsChangedDetail,
} from "@/lib/daily-missions";
import { pushToast } from "@/lib/ui/popup-queue";

/**
 * "Mission complete" toasts for Daily Missions paid outside a ClubFundsEarned popup
 * (e.g. puzzles). Mount where runs end; it only listens for reportMissionEvent payouts and
 * hands them to the global toast queue (ToastHost), so they show one at a time and never
 * on top of a reward sheet.
 */
export function DailyMissionToast() {
  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<DailyMissionsChangedDetail>).detail;
      if (!detail) return;
      for (const m of detail.completed) {
        pushToast({ kicker: "Mission complete", title: m.title, amount: m.reward });
      }
      if (detail.bonus > 0) {
        pushToast({ kicker: "Daily missions", title: "All three daily missions done", amount: detail.bonus });
      }
    };
    window.addEventListener(DAILY_MISSIONS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DAILY_MISSIONS_CHANGED_EVENT, onChange);
  }, []);

  return null;
}
