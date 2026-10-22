"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameDifficulty, LeaderboardPeriod } from "@/lib/types";
import { formatPeriodLabel } from "@/lib/leaderboard";
import {
  getDefaultTrackerForDbMode,
  getTrackersForDbMode,
  getTrophyCabinetLogicalId,
  isTrackerValidForDbMode,
  resolveTrophyCabinetTracker,
  TROPHY_CABINET_CATEGORIES,
  type LeaderboardTrackerRow,
  type LeaderboardTrackerType,
  type TrophyCabinetSection,
} from "@/lib/leaderboard-trackers";
import {
  getTrackerLeaderboardAsync,
} from "@/lib/storage/leaderboard";
import {
  getNormalEraVariant,
  setNormalEraVariant,
  NORMAL_ERA_VARIANT_CHANGED_EVENT,
} from "@/lib/storage/preferences";
import { ChallengeCupVariantToggle } from "./ChallengeCupVariantToggle";
import {
  LeaderboardTabBar,
  type LeaderboardTabAccent,
} from "./LeaderboardTabBar";
import { getDailyLeaderboardAsync } from "@/lib/storage/daily-leaderboard";
import {
  getMiniGameWinsLeaderboardAsync,
  MINI_GAME_WINS_CATEGORIES,
  type MiniGameWinsKind,
} from "@/lib/storage/mini-games-leaderboard";
import { RecordWithPercentage, parseRecordWithPercentage } from "./RecordWithPercentage";
import { GamePanel } from "@/components/ui/GamePanel";
import { GameEmptyState } from "@/components/ui/GameEmptyState";
import { getDailyChallengeHref } from "@/lib/daily-challenge";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { GameButton } from "@/components/ui/GameButton";
import { ScoreboardPanel } from "@/components/ui/ScoreboardPanel";
import { TYPO } from "@/lib/ui/typography";
import { useAuth } from "@/lib/auth-context";
import { CoachNameplate, frameRowClass, useCoachFlairs } from "@/lib/coach-flair";
import { useCosmetics } from "@/lib/storage/cosmetics-store";
import { titleName } from "@/lib/cosmetics";

const PERIODS: LeaderboardPeriod[] = ["WEEKLY", "MONTHLY", "ALL_TIME"];

const QUICK_MODE_ACCENTS = {
  "super-league": "green",
  "trophy-cabinet": "gold",
  daily: "amber",
  quiz: "gold",
} as const satisfies Record<string, LeaderboardTabAccent>;

const MINI_GAMES_CATEGORY_ACCENTS: Record<
  MiniGameWinsKind,
  LeaderboardTabAccent
> = {
  wordle: "green",
  hangman: "amber",
  "higher-lower": "theme",
  "quiz-wins": "gold",
};

const TRACKER_ACCENTS: Partial<
  Record<LeaderboardTrackerType, LeaderboardTabAccent>
> = {
  perfect_runs: "green",
  wcc_wins: "amber",
  best_record: "theme",
  league_titles: "green",
  super_league_champions: "gold",
  era_league_title: "green",
  era_league_champions: "gold",
  daily_streak: "amber",
};

const STAT_COLUMN: Partial<Record<LeaderboardTrackerType, string>> = {
  perfect_runs: "27-0 Seasons",
  wcc_wins: "WCC Wins",
  best_record: "Total Record",
  league_titles: "League Leaders",
  super_league_champions: "SL Titles",
  era_league_title: "League Leaders",
  era_league_champions: "SL Titles",
  daily_streak: "Best Streak",
};

type QuickLeaderboardMode = "super-league" | "trophy-cabinet" | "daily" | "quiz";

/**
 * `mode` makes the board controlled by the page's top-level tabs (Classic / Daily / Manager);
 * its own mode tabs are then hidden.
 */
export function LeaderboardTable({ mode }: { mode?: "super-league" | "daily" } = {}) {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [leaderboardMode, setLeaderboardMode] =
    useState<QuickLeaderboardMode>(mode ?? "super-league");
  const [tracker, setTracker] = useState<LeaderboardTrackerType>("best_record");
  const [miniGamesCategory, setMiniGamesCategory] =
    useState<MiniGameWinsKind>("wordle");
  const [period, setPeriod] = useState<LeaderboardPeriod>("ALL_TIME");
  const difficulty: GameDifficulty = "NORMAL";
  const [entries, setEntries] = useState<LeaderboardTrackerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [normalEraMode, setNormalEraMode] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const trackerParam = params.get("tracker");
    if (trackerParam === "daily_streak") {
      if (SHOW_DAILY_CHALLENGE_UI) {
        setLeaderboardMode("daily");
        setTracker("daily_streak");
      } else {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
    if (trackerParam === "quiz_prize" || trackerParam === "quiz_wins") {
      setLeaderboardMode("quiz");
      setMiniGamesCategory("quiz-wins");
    }
  }, []);

  useEffect(() => {
    setNormalEraMode(getNormalEraVariant());
    const onNormalEra = (event: Event) => {
      const detail = (event as CustomEvent<{ eraMode: boolean }>).detail;
      if (detail) setNormalEraMode(detail.eraMode);
    };
    window.addEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onNormalEra);
    return () => {
      window.removeEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onNormalEra);
    };
  }, []);

  const isMiniGamesMode = leaderboardMode === "quiz";
  const availableTrackers = isMiniGamesMode
    ? []
    : getTrackersForDbMode(leaderboardMode);

  const activeTracker =
    isMiniGamesMode
      ? tracker
      : isTrackerValidForDbMode(tracker, leaderboardMode)
        ? tracker
        : getDefaultTrackerForDbMode(leaderboardMode);

  const isDailyMode =
    SHOW_DAILY_CHALLENGE_UI && leaderboardMode === "daily";
  const isTrophyCabinetMode = leaderboardMode === "trophy-cabinet";
  const activeMiniGamesCategory =
    MINI_GAME_WINS_CATEGORIES.find((c) => c.id === miniGamesCategory) ??
    MINI_GAME_WINS_CATEGORIES[0]!;

  const handleQuickModeChange = (mode: QuickLeaderboardMode) => {
    setLeaderboardMode(mode);
    if (mode !== "quiz") {
      setTracker(getDefaultTrackerForDbMode(mode));
    }
  };

  useEffect(() => {
    if (mode && mode !== leaderboardMode) handleQuickModeChange(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const isSuperLeagueMode = leaderboardMode === "super-league";
  const showCupVariantToggle = isSuperLeagueMode || isTrophyCabinetMode;
  const superLeagueModeVariant = normalEraMode ? "era" : "current";
  const trophySection: TrophyCabinetSection = normalEraMode ? "era" : "current";

  const trophyLogicalId =
    getTrophyCabinetLogicalId(activeTracker) ?? "league_titles";

  const resolvedTrophyTracker = isTrophyCabinetMode
    ? resolveTrophyCabinetTracker(trophyLogicalId, trophySection)
    : activeTracker;

  const effectiveTracker = isTrophyCabinetMode
    ? resolvedTrophyTracker
    : activeTracker;

  const loadEntries = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);

    try {
      if (isMiniGamesMode) {
        const result = await getMiniGameWinsLeaderboardAsync(miniGamesCategory);
        if (currentRequest !== requestId.current) return;
        setEntries(result.rows);
        setUsingFallback(result.source === "local");
        return;
      }

      if (isDailyMode || isTrophyCabinetMode) {
        const result = isDailyMode
          ? await getDailyLeaderboardAsync()
          : await getTrackerLeaderboardAsync(
              effectiveTracker,
              period,
              difficulty,
              50,
              "trophy-cabinet"
            );
        if (currentRequest !== requestId.current) return;
        setEntries(result.rows);
        setUsingFallback(result.source === "local");
        return;
      }

      const result = await getTrackerLeaderboardAsync(
        activeTracker,
        period,
        difficulty,
        50,
        leaderboardMode,
        isSuperLeagueMode ? superLeagueModeVariant : "current"
      );

      if (currentRequest !== requestId.current) return;

      setEntries(result.rows);
      setUsingFallback(result.source === "local");
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, [
    period,
    difficulty,
    leaderboardMode,
    activeTracker,
    effectiveTracker,
    isDailyMode,
    isTrophyCabinetMode,
    isSuperLeagueMode,
    superLeagueModeVariant,
    normalEraMode,
    isMiniGamesMode,
    miniGamesCategory,
  ]);

  useEffect(() => {
    if (isTrophyCabinetMode) {
      const logical = getTrophyCabinetLogicalId(tracker) ?? "league_titles";
      const resolved = resolveTrophyCabinetTracker(logical, trophySection);
      if (tracker !== resolved) {
        setTracker(resolved);
      }
      return;
    }
    if (isMiniGamesMode) return;
    if (!isTrackerValidForDbMode(tracker, leaderboardMode)) {
      setTracker(getDefaultTrackerForDbMode(leaderboardMode));
    }
  }, [
    leaderboardMode,
    tracker,
    isTrophyCabinetMode,
    trophySection,
    isMiniGamesMode,
  ]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const modeLabel =
    leaderboardMode === "daily"
      ? "Daily"
      : leaderboardMode === "trophy-cabinet"
        ? "Trophies"
        : isMiniGamesMode
          ? "Mini Games"
          : "Classic";

  const trackerLabel = isMiniGamesMode
    ? activeMiniGamesCategory.label
    : isTrophyCabinetMode
      ? (TROPHY_CABINET_CATEGORIES.find((c) => c.logicalId === trophyLogicalId)
          ?.label ?? "Leaderboard")
      : (availableTrackers.find((t) => t.id === activeTracker)?.label ??
        "Leaderboard");

  const statColumnLabel = isMiniGamesMode
    ? "Total Wins"
    : (STAT_COLUMN[effectiveTracker] ?? "Stat");

  const quickModeOptions: {
    id: QuickLeaderboardMode;
    label: string;
  }[] = [
    { id: "super-league" as const, label: "Classic" },
    { id: "trophy-cabinet" as const, label: "Trophies" },
    ...(SHOW_DAILY_CHALLENGE_UI
      ? [{ id: "daily" as const, label: "Daily" }]
      : []),
    { id: "quiz" as const, label: "Mini Games" },
  ];

  const emptyStateMessage = isDailyMode
    ? "No streaks yet. Finish a Daily Challenge."
    : isMiniGamesMode
      ? `No ${activeMiniGamesCategory.label.toLowerCase()} yet. Win a game to climb the board.`
      : "Finish a Classic season to get on the board.";

  const showUpdatedColumn =
    !isDailyMode && !isTrophyCabinetMode && !isMiniGamesMode;

  const showPeriodFilters =
    !isDailyMode && !isTrophyCabinetMode && !isMiniGamesMode;

  const flairs = useCoachFlairs(entries.map((e) => e.username));
  const myCosmetics = useCosmetics();
  // Your own row shows what you have equipped right now, even before it syncs.
  const flairFor = (entry: { username: string; isCurrentUser?: boolean }) =>
    entry.isCurrentUser
      ? { title: titleName(myCosmetics.equipped.title) ?? undefined, frame: myCosmetics.equipped.frame ?? undefined }
      : flairs[entry.username] ?? {};
  return (
    <div>
      {mode ? null : (
      <nav className="mb-5" aria-label="Leaderboard modes">
        <LeaderboardTabBar
          tier="mode"
          tabs={quickModeOptions.map((mode) => ({
            id: mode.id,
            label: mode.label,
            accent: QUICK_MODE_ACCENTS[mode.id],
          }))}
          active={leaderboardMode}
          onChange={(id) => handleQuickModeChange(id as QuickLeaderboardMode)}
          ariaLabel="Leaderboard modes"
        />
      </nav>
      )}

      {showCupVariantToggle && (
        <div className="mb-5">
          <ChallengeCupVariantToggle
            sectionLabel={isTrophyCabinetMode ? "Squads" : "Mode"}
            useShortLabels
            eraMode={normalEraMode}
            onEraModeChange={(era) => {
              setNormalEraMode(era);
              setNormalEraVariant(era);
            }}
          />
        </div>
      )}

      <div className="mb-5">
        {isTrophyCabinetMode ? (
          <LeaderboardTabBar
            tier="category"
            tabs={TROPHY_CABINET_CATEGORIES.map((category) => ({
              id: category.logicalId,
              label: category.shortLabel,
              accent:
                TRACKER_ACCENTS[
                  trophySection === "era"
                    ? category.eraTracker
                    : category.currentTracker
                ],
            }))}
            active={trophyLogicalId}
            onChange={(id) => {
              const logical = id as "league_titles" | "champions";
              setTracker(resolveTrophyCabinetTracker(logical, trophySection));
            }}
            ariaLabel="Trophy cabinet category"
          />
        ) : isMiniGamesMode ? (
          <LeaderboardTabBar
            tier="category"
            tabs={MINI_GAME_WINS_CATEGORIES.map((category) => ({
              id: category.id,
              label: category.shortLabel,
              accent: MINI_GAMES_CATEGORY_ACCENTS[category.id],
            }))}
            active={miniGamesCategory}
            onChange={(id) => setMiniGamesCategory(id as MiniGameWinsKind)}
            ariaLabel="Mini games category"
          />
        ) : (
          availableTrackers.length > 1 && (
            <LeaderboardTabBar
              tier="category"
              tabs={availableTrackers.map((t) => ({
                id: t.id,
                label: t.shortLabel,
                accent: TRACKER_ACCENTS[t.id],
              }))}
              active={activeTracker}
              onChange={(id) => setTracker(id)}
              scrollable={availableTrackers.length > 4}
              ariaLabel="Leaderboard category"
            />
          )
        )}
      </div>

      {showPeriodFilters && (
        <nav className="mb-6" aria-label="Leaderboard period">
          <LeaderboardTabBar
            tier="period"
            tabs={PERIODS.map((p) => ({
              id: p,
              label: formatPeriodLabel(p),
            }))}
            active={period}
            onChange={(p) => setPeriod(p)}
            ariaLabel="Leaderboard period"
          />
        </nav>
      )}

      {loading && entries.length === 0 ? (
        <GamePanel variant="elevated" className="overflow-hidden p-0" aria-busy="true" aria-label="Loading leaderboard">
          <ul className="divide-y divide-pitch-700/30" aria-hidden>
            {Array.from({ length: 6 }).map((_, index) => (
              <li
                key={`skeleton-${index}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="h-4 w-6 animate-pulse rounded bg-pitch-700/50" />
                  <span className="h-4 w-32 max-w-[50%] animate-pulse rounded bg-pitch-700/40" />
                </div>
                <span className="h-4 w-16 animate-pulse rounded bg-pitch-700/40" />
              </li>
            ))}
          </ul>
        </GamePanel>
      ) : entries.length === 0 ? (
        <GamePanel variant="elevated" className="p-6 sm:p-8">
          <GameEmptyState
            title="No entries yet"
            message={emptyStateMessage}
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <GameButton
                  variant="theme"
                  size="sm"
                  fullWidth={false}
                  href={
                    isDailyMode
                      ? getDailyChallengeHref()
                      : isMiniGamesMode
                        ? activeMiniGamesCategory.href
                        : "/play"
                  }
                >
                  {isDailyMode
                    ? "Play Daily Challenge"
                    : isMiniGamesMode
                      ? `Play ${activeMiniGamesCategory.shortLabel}`
                      : "Play Classic"}
                </GameButton>
                {!authLoading && !isLoggedIn ? (
                  <GameButton
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    href={
                      isDailyMode
                        ? "/login?redirect=/leaderboard?tracker=daily_streak"
                        : "/login?redirect=/leaderboard"
                    }
                  >
                    Log in to submit
                  </GameButton>
                ) : null}
              </div>
            }
          />
        </GamePanel>
      ) : (
        <ScoreboardPanel
          variant="elevated"
          className={`overflow-hidden transition-opacity ${
            loading ? "opacity-60" : "opacity-100"
          }`}
        >
          {/* One list on every screen size. A frame bought in the Store wraps the coach's whole row. */}
          <ul className="fl-stagger flex flex-col gap-1.5 p-2" aria-label={`${trackerLabel} rankings`}>
            <li aria-hidden className="hidden grid-cols-[2.5rem_minmax(0,1fr)_auto_7rem] gap-3 px-3 pb-1 pt-1 text-xs font-semibold text-gray-500 sm:grid">
              <span>#</span>
              <span>Coach</span>
              <span className="text-right">{statColumnLabel}</span>
              <span className="text-right">{showUpdatedColumn ? "Updated" : ""}</span>
            </li>
            {entries.map((entry) => {
              const flair = flairFor(entry);
              const framed = frameRowClass(flair.frame);
              return (
                <li
                  key={`${entry.rank}-${entry.username}-${entry.achievedAt}`}
                  className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-tile px-3 py-2.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_7rem] ${
                    framed || (entry.isCurrentUser ? "bg-theme-primary/5" : "")
                  }`}
                >
                  <span
                    className={`font-display font-bold tabular-nums ${
                      entry.rank <= 3 ? "text-accent-gold" : "text-gray-400"
                    }`}
                  >
                    {entry.rank}
                  </span>
                  <CoachNameplate className={TYPO.identityLine} name={entry.username} title={flair.title} />
                  <span className="text-right font-semibold text-accent-gold">
                    {renderLeaderboardStat(entry, effectiveTracker)}
                  </span>
                  <span className="hidden text-right text-sm text-gray-500 sm:block">
                    {showUpdatedColumn ? (entry.achievedAt ? new Date(entry.achievedAt).toLocaleDateString() : "—") : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </ScoreboardPanel>
      )}

      <p className="mt-4 text-center text-xs text-gray-600">
        {usingFallback
          ? "Offline: showing scores saved on this device"
          : "Live rankings for all players"}
        {" · "}
        {modeLabel}
        {" · "}
        {trackerLabel}
      </p>
    </div>
  );
}

function renderLeaderboardStat(
  entry: LeaderboardTrackerRow,
  activeTracker: LeaderboardTrackerType
) {
  if (activeTracker === "best_record") {
    const parsed = parseRecordWithPercentage(entry.statDisplay);
    if (parsed) {
      return (
        <RecordWithPercentage wins={parsed.wins} losses={parsed.losses} />
      );
    }
    return entry.statDisplay;
  }

  const plainNumber = entry.statDisplay.match(/^[\d.]+$/);
  if (plainNumber) {
    return String(Math.round(Number.parseFloat(entry.statDisplay)));
  }

  return entry.statDisplay;
}
