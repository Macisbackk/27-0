"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FlairBadge, frameRowClass } from "@/lib/coach-flair";
import { formatClubFunds } from "@/lib/club-funds";
import { getClubFundsBalance } from "@/lib/storage/club-funds";
import { getAllStats } from "@/lib/storage/stats";
import { loadLocalLegacy } from "@/lib/career/storage";
import { getUnlockedAchievements } from "@/lib/achievements/achievementEngine";
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/achievements/achievementDefinitions";

interface Snapshot {
  funds: number;
  classicBest: string;
  eraBest: string;
  managerTrophies: number;
  achievements: number;
}

function readSnapshot(): Snapshot {
  const stats = getAllStats();
  const rec = (w: number, l: number) => (w + l > 0 ? `${w}-${l}` : "—");
  const legacy = loadLocalLegacy();
  let unlocked = 0;
  try {
    unlocked = getUnlockedAchievements().length;
  } catch {
    unlocked = 0;
  }
  return {
    funds: getClubFundsBalance(),
    classicBest: rec(stats.normal.bestRecordWins, stats.normal.bestRecordLosses),
    eraBest: rec(stats.eraNormal.bestRecordWins, stats.eraNormal.bestRecordLosses),
    managerTrophies: Object.values(legacy.trophies ?? {}).reduce((t, n) => t + (n || 0), 0),
    achievements: unlocked,
  };
}

/**
 * The coach's card at the top of the profile: name, title and the Store frame (the same frame
 * that wraps their leaderboard row), plus the four numbers people care about.
 */
export function CoachCard({
  name,
  title,
  frame,
  subline,
}: {
  name: string;
  title?: string | null;
  frame?: string | null;
  subline?: string | null;
}) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  useEffect(() => {
    try {
      setSnap(readSnapshot());
    } catch {
      setSnap(null);
    }
  }, []);
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "C";
  const tiles: Array<[string, string]> = [
    ["Club Funds", snap ? formatClubFunds(snap.funds) : "—"],
    ["Best Classic", snap?.classicBest ?? "—"],
    ["Best Era", snap?.eraBest ?? "—"],
    ["Manager trophies", snap ? String(snap.managerTrophies) : "—"],
  ];

  return (
    <section aria-label="Coach card" className={`rounded-card bg-pitch-900 p-4 text-left ${frameRowClass(frame)}`}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-theme-primary font-display text-xl text-[color:var(--theme-text-on-primary)]"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 flex-wrap items-center font-cond text-[24px] font-bold leading-tight text-white">
            <span className="min-w-0 truncate">{name}</span>
            <FlairBadge title={title} />
          </p>
          {subline ? <p className="mt-0.5 text-xs text-[color:var(--fl-muted)]">{subline}</p> : null}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-tile bg-pitch-950 px-3 py-2.5">
            <dt className="text-[11px] font-semibold text-[color:var(--fl-muted)]">{label}</dt>
            <dd className="mt-0.5 font-display text-xl leading-tight text-white">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--fl-muted)]">
        <span>
          {snap ? `${snap.achievements} of ${ACHIEVEMENT_DEFINITIONS.length} achievements` : ""}
        </span>
        <Link href="/store" className="font-semibold text-theme-primary hover:underline">
          Change frame or title
        </Link>
      </div>
    </section>
  );
}
