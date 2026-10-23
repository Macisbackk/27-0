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
        type Row = { coach_name: string | null; flair: string | null; frame?: string | null };
        const withFrame = await supabase.from("profiles").select("coach_name, flair, frame").in("coach_name", coaches);
        let data = withFrame.data as Row[] | null;
        let error = withFrame.error;
        if (error) {
          // Older database without the frame column.
          const titlesOnly = await supabase.from("profiles").select("coach_name, flair").in("coach_name", coaches);
          data = titlesOnly.data as Row[] | null;
          error = titlesOnly.error;
        }
        if (error || !data || cancelled) return;
        const out: Record<string, CoachFlair> = {};
        for (const row of data) {
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

export function FlairBadge({ title, className = "ml-1.5" }: { title?: string | null; className?: string }) {
  if (!title) return null;
  return <span className={`inline-flex shrink-0 items-center rounded-full bg-amber-400/15 px-2 py-0.5 align-middle text-[10px] font-bold text-amber-300 ${className}`}>{title}</span>;
}

/** Row classes for a leaderboard frame bought in the Store: the frame wraps the coach's whole row. */
export function frameRowClass(frame?: string | null): string {
  const kind = frame?.replace(/^frame-/, "");
  return kind && ["gold", "foil", "programme"].includes(kind) ? `lb-row lb-row--${kind}` : "";
}

/** A coach's name with their title. Frames now wrap the whole leaderboard row (see frameRowClass). */
export function CoachNameplate({
  name,
  title,
  className = "",
}: {
  name: ReactNode;
  /** Ignored: kept so older call sites still compile. */
  frame?: string | null;
  title?: string | null;
  className?: string;
}) {
  // Phones: the title sits under the name and the name wraps, so a frame + title never cut the
  // name off. Wider screens: one line.
  return (
    <span className={`flex min-w-0 max-w-full flex-col items-start gap-0.5 sm:inline-flex sm:flex-row sm:items-center sm:gap-0 ${className}`}>
      <span className="coach-name min-w-0 max-w-full [overflow-wrap:anywhere] sm:truncate">{name}</span>
      <FlairBadge title={title} className="sm:ml-1.5" />
    </span>
  );
}
