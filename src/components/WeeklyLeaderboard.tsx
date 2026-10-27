"use client";

import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GamePanel } from "@/components/ui/GamePanel";
import { useAuth } from "@/lib/auth-context";
import { CoachNameplate, frameRowClass, useCoachFlairs } from "@/lib/coach-flair";
import { titleName } from "@/lib/cosmetics";
import { formatClubFunds } from "@/lib/club-funds";
import { useCosmetics } from "@/lib/storage/cosmetics-store";
import { useHiddenCoachIds } from "@/lib/storage/hidden-coaches";
import { displayCoachName } from "@/lib/moderation/name-filter";
import { CoachRowActions } from "./CoachRowActions";
import { HiddenCoachesNote } from "./HiddenCoachesNote";
import {
  getWeeklyLeaderboardAsync,
  type WeeklyLeaderboardRow,
} from "@/lib/storage/weekly-leaderboard";
import { TYPO } from "@/lib/ui/typography";
import {
  formatWeeklyResetCountdown,
  getPreviousWeeklyChallengeWeekKey,
  getWeeklyChallengeHref,
  getWeeklyChallengeScenario,
  getWeeklyChallengeScenarioForWeek,
  getWeeklyChallengeWeekKey,
  WEEKLY_TOP10_REWARD,
} from "@/lib/weekly-challenge";

type WeekView = "this" | "last";

/** Weekly Challenge board: this week (live) or last week (final), top 50, the top 10 marked. */
export function WeeklyLeaderboard() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [view, setView] = useState<WeekView>("this");
  const [rows, setRows] = useState<WeeklyLeaderboardRow[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [week, setWeek] = useState<{ key: string; title: string; resetsIn: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const now = new Date();
    const key = view === "this" ? getWeeklyChallengeWeekKey(now) : getPreviousWeeklyChallengeWeekKey(now);
    const scenario = view === "this" ? getWeeklyChallengeScenario(now) : getWeeklyChallengeScenarioForWeek(key);
    setRows(null);
    setWeek({ key, title: scenario.ruleTitle, resetsIn: formatWeeklyResetCountdown(now) });
    void getWeeklyLeaderboardAsync(key)
      .then((result) => {
        if (!alive) return;
        setRows(result.rows);
        setOffline(result.source === "local");
      })
      .catch(() => {
        if (!alive) return;
        setRows([]);
        setOffline(true);
      });
    return () => {
      alive = false;
    };
  }, [view]);

  // Empty this-week board: show last week's top 3 as scores to beat.
  const [lastWeekTop, setLastWeekTop] = useState<WeeklyLeaderboardRow[] | null>(null);
  useEffect(() => {
    if (view !== "this" || rows === null || rows.length > 0) return;
    let alive = true;
    void getWeeklyLeaderboardAsync(getPreviousWeeklyChallengeWeekKey(new Date()), 3)
      .then((result) => {
        if (alive) setLastWeekTop(result.rows.slice(0, 3));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [view, rows]);

  const hiddenIds = useHiddenCoachIds();
  // Coaches you hid don't show on your boards (rank numbers stay as they are).
  const visibleRows = (rows ?? []).filter((r) => r.isCurrentUser || !r.userId || !hiddenIds.has(r.userId));
  const hiddenCount = (rows?.length ?? 0) - visibleRows.length;
  const flairs = useCoachFlairs((rows ?? []).map((r) => r.username));
  const myCosmetics = useCosmetics();
  // Your own row shows what you have equipped right now, even before it syncs.
  const flairFor = (row: WeeklyLeaderboardRow) =>
    row.isCurrentUser
      ? { title: titleName(myCosmetics.equipped.title) ?? undefined, frame: myCosmetics.equipped.frame ?? undefined }
      : flairs[row.username] ?? {};

  return (
    <section className="space-y-3" aria-label="Weekly Challenge leaderboard">
      <div className="flex justify-center gap-2" role="group" aria-label="Which week">
        {(["this", "last"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-pressed={view === id}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              view === id ? "bg-accent-gold text-pitch-950" : "bg-pitch-800 text-gray-300 hover:text-white"
            }`}
          >
            {id === "this" ? "This week" : "Last week"}
          </button>
        ))}
      </div>
      <p className={`text-center ${TYPO.bodySm}`}>
        {view === "this"
          ? `${week ? `${week.title} · resets in ${week.resetsIn}. ` : ""}Top 10 earn ${formatClubFunds(WEEKLY_TOP10_REWARD)}.`
          : `${week ? `${week.title} · final. ` : ""}Top 10 earned ${formatClubFunds(WEEKLY_TOP10_REWARD)}.`}
      </p>
      <GamePanel variant="elevated" className="overflow-hidden p-0">
        {rows === null ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400" role="status">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="font-display text-base font-bold text-white">
              {view === "this" ? "Be the first on this week's board" : "No scores last week"}
            </p>
            <p className="text-sm text-gray-300">
              {view === "this"
                ? `Play the Weekly. Top 10 on Sunday night earn ${formatClubFunds(WEEKLY_TOP10_REWARD)}.`
                : "Nobody played last week."}
            </p>
            {view === "this" && lastWeekTop && lastWeekTop.length > 0 ? (
              <div className="w-full max-w-xs rounded-tile bg-pitch-900/70 px-3 py-2 text-left" aria-label="Last week's top 3">
                <p className="text-xs font-semibold text-gray-400">Scores to beat (last week)</p>
                <ol className="mt-1 space-y-0.5 text-sm">
                  {lastWeekTop.map((row) => (
                    <li key={row.userId ?? row.username} className="flex justify-between gap-3">
                      <span className="truncate text-gray-200">
                        {row.rank}. {displayCoachName(row.username, row.userId)}
                      </span>
                      <span className="font-semibold tabular-nums text-accent-gold">{row.score}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {view === "this" ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <GameButton variant="theme" size="sm" fullWidth={false} href={getWeeklyChallengeHref()}>
                Play the Weekly
              </GameButton>
              {!authLoading && !isLoggedIn ? (
                <GameButton
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  href="/login?redirect=/leaderboard?tracker=weekly"
                >
                  Log in to submit
                </GameButton>
              ) : null}
            </div>
            ) : null}
          </div>
        ) : (
          <ol className="fl-stagger flex flex-col gap-1.5 p-2" aria-label="Weekly Challenge rankings">
            <li aria-hidden className="hidden grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-3 px-3 pb-1 pt-1 text-xs font-semibold text-gray-500 sm:grid">
              <span>#</span>
              <span>Coach</span>
              <span className="text-right">Score</span>
            </li>
            {visibleRows.map((row) => {
              const flair = flairFor(row);
              const shownName = displayCoachName(row.username, row.userId);
              const framed = frameRowClass(flair.frame);
              return (
                <li
                  key={row.userId ?? row.username}
                  className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-tile px-3 py-2.5 ${
                    framed || (row.isCurrentUser ? "bg-theme-primary/5" : "")
                  }`}
                  aria-current={row.isCurrentUser ? "true" : undefined}
                >
                  <span
                    className={`font-display font-bold tabular-nums ${
                      row.rank <= 3 ? "text-accent-gold" : "text-gray-400"
                    }`}
                  >
                    {row.rank}
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <CoachNameplate className={TYPO.identityLine} name={shownName} title={flair.title} />
                    {row.topTen ? (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-accent-gold/15 px-2 py-0.5 text-[10px] font-bold text-accent-gold">
                        Top 10
                      </span>
                    ) : null}
                    {!row.isCurrentUser && !offline ? (
                      <span className="ml-auto">
                        <CoachRowActions userId={row.userId} coachName={row.username} displayName={shownName} board="weekly" />
                      </span>
                    ) : null}
                  </span>
                  <span className="whitespace-nowrap text-right font-semibold leading-tight text-accent-gold">
                    {row.score}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </GamePanel>
      <HiddenCoachesNote count={hiddenCount} />
      <p className="text-center text-xs text-gray-600">
        {offline
          ? "Offline: showing your score saved on this device"
          : view === "this"
            ? "Live rankings"
            : "Final rankings"}
        {" · "}Weekly{week ? ` · ${week.key}` : ""}
      </p>
    </section>
  );
}
