"use client";

import { useEffect } from "react";
import { getCachedCoachName } from "@/lib/auth-session";
import { runCoachbeardAccountMergeLocal } from "@/lib/storage/coachbeard-account-merge";
import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * One-time localStorage migration: coachbeard2 → coachbeard.
 * Runs on every page load until the completion flag is set.
 */
export function CoachbeardMergeRunner() {
  useEffect(() => {
    void (async () => {
      let email: string | null = null;
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase.auth.getSession();
          email = data.session?.user?.email ?? null;
        } catch {
          /* ignore */
        }
      }

      const report = runCoachbeardAccountMergeLocal({
        coachName: getCachedCoachName(),
        email,
      });

      if (!report.skipped && report.hadSecondaryData) {
        console.info("[coachbeard-merge] local migration complete", report);
      }
      if (report.coachbeard2StillVisible) {
        console.warn(
          "[coachbeard-merge] coachbeard2 still visible in local data",
          report
        );
      }
    })();
  }, []);

  return null;
}
