"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabase";
import { titleName } from "./cosmetics";

/**
 * Store titles for leaderboard names: coach name → title. Reads profiles.flair (public column);
 * returns nothing until that column exists, so leaderboards simply show no titles.
 */
export function useCoachFlairs(names: string[]): Record<string, string> {
  const key = [...new Set(names)].sort().join("|");
  const [flairs, setFlairs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isSupabaseConfigured || !key) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("coach_name, flair").in("coach_name", key.split("|")).not("flair", "is", null);
        if (error || !data || cancelled) return;
        const out: Record<string, string> = {};
        for (const row of data as { coach_name: string | null; flair: string | null }[]) {
          const t = titleName(row.flair);
          if (row.coach_name && t) out[row.coach_name] = t;
        }
        setFlairs(out);
      } catch {
        /* no flair column yet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);
  return flairs;
}

export function FlairBadge({ title }: { title?: string | null }) {
  if (!title) return null;
  return <span className="ml-1.5 inline-flex shrink-0 items-center rounded-full bg-amber-400/15 px-2 py-0.5 align-middle text-[10px] font-bold text-amber-300">{title}</span>;
}
