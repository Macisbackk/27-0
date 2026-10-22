"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "./supabase";
import { titleName } from "./cosmetics";

export type CoachFlair = { title?: string; frame?: string };

/**
 * Store flair for leaderboard names: coach name → { title, frame }. Reads the public
 * profiles.flair / profiles.frame columns; anything missing just shows nothing.
 */
export function useCoachFlairs(names: string[]): Record<string, CoachFlair> {
  const key = [...new Set(names)].sort().join("|");
  const [flairs, setFlairs] = useState<Record<string, CoachFlair>>({});
  useEffect(() => {
    if (!isSupabaseConfigured || !key) return;
    let cancelled = false;
    void (async () => {
      try {
        const coaches = key.split("|");
        let { data, error } = await supabase
          .from("profiles")
          .select("coach_name, flair, frame")
          .in("coach_name", coaches);
        if (error) {
          // Older database without the frame column.
          ({ data, error } = await supabase.from("profiles").select("coach_name, flair").in("coach_name", coaches));
        }
        if (error || !data || cancelled) return;
        const out: Record<string, CoachFlair> = {};
        for (const row of data as { coach_name: string | null; flair: string | null; frame?: string | null }[]) {
          if (!row.coach_name) continue;
          const title = titleName(row.flair) ?? undefined;
          const frame = row.frame ?? undefined;
          if (title || frame) out[row.coach_name] = { title, frame };
        }
        setFlairs(out);
      } catch {
        /* columns not there yet */
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

/** The coach's name on a leaderboard, in their Store frame when they have one. */
export function CoachNameplate({
  name,
  frame,
  title,
  className = "",
}: {
  name: ReactNode;
  frame?: string | null;
  title?: string | null;
  className?: string;
}) {
  const kind = frame?.replace(/^frame-/, "");
  return (
    <span className={`inline-flex min-w-0 max-w-full items-center ${className}`}>
      <span className={`min-w-0 truncate ${kind ? `lb-nameplate lb-nameplate--${kind}` : ""}`}>{name}</span>
      <FlairBadge title={title} />
    </span>
  );
}
