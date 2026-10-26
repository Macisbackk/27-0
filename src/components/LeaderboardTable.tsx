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
import {
  getDailyLeaderboardAsync,
  getDailyScoreLeaderboardAsync,
} from "@/lib/storage/daily-leaderboard";
import { GameModal } from "@/components/ui/GameModal";
import { DailyStreakStrip } from "./DailyStreakStrip";
import { DAILY_MAX_SCORE } from "@/lib/daily-streak";
import type { RecordMetric } from "@/lib/leaderboard-trackers";
import {
  getMiniGameWinsLeaderboardAsync,
  MINI_GAME_WINS_CATEGORIES,
  type MiniGameWinsKind,
} from "@/lib/storage/mini-games-leaderboard";
import { getQuizLeaderboardAsync } from "@/lib/storage/quiz-leaderboard";
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
import { CoachRowActions } from "./CoachRowActions";
import { HiddenCoachesNote } from "./HiddenCoachesNote";
import { displayCoachName } from "@/lib/moderation/name-filter";
import { useHiddenCoachIds } from "@/lib/storage/hidden-coaches";
import type { ReportBoard } from "@/lib/moderation/reports";

const PERIODS: LeaderboardPeriod[] = ["WEEKLY", "MONTHLY", "ALL_TIME"];

const QUICK_MODE_ACCENTS = {
  "super-league": "green",
  "trophy-cabinet": "gold",
  daily: "amber",
  quiz: "gold",
} as const satisfies Record<string, LeaderboardTabAccent>;

/** Puzzles tab: the mini-game win boards plus the Golden Point Quiz highest-prize board. */
type PuzzlesCategory = MiniGameWinsKind | "quiz-prize";

const QUIZ_PRIZE_CATEGORY = {
  id: "quiz-prize" as const,
  label: "Quiz Top Prize",
  shortLabel: "Prize",
  href: "/mini-games/quiz",
};

const PUZZLES_CATEGORIES: Array<{
  id: PuzzlesCategory;
  label: string;
  shortLabel: string;
  href: string;
}> = [...MINI_GAME_WINS_CATEGORIES, QUIZ_PRIZE_CATEGORY];

const MINI_GAMES_CATEGORY_ACCENTS: Record<PuzzlesCategory, LeaderboardTabAccent> = {
  wordle: "green",
  grid: "theme",
  "quiz-wins": "gold",
  "quiz-prize": "amber",
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
 * Classic ranking views (v1.18). "Best season" is the default: the old default ranked by career
 * wins, which rewarded volume (a 27-0 season sat 21st). Career W–L stays as "Total record".
 */
type ClassicView = "best_season" | "total_record" | Exclude<LeaderboardTrackerType, "best_record">;

type DailyView = "today" | "streak";

const DAILY_VIEWS: { id: DailyView; label: string }[] = [
  { id: "today", label: "Today's score" },
  { id: "streak", label: "Best streak" },
];

/**
 * `mode` makes the board controlled by the page's top-level tabs (Classic / Daily / Manager);
 * its own mode tabs are then hidden.
 */
export function LeaderboardTable({ mode }: { mode?: "super-league" | "daily" } = {}) {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [leaderboardMode, setLeaderboardMode] =
    useState<QuickLeaderboardMode>(mode ?? "super-league");
  const [tracker, setTracker] = useState<LeaderboardTrackerType>("best_record");
  const [classicView, setClassicView] = useState<ClassicView>("best_season");
  const [dailyView, setDailyView] = useState<DailyView>("today");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [miniGamesCategory, setMiniGamesCategory] =
    useState<PuzzlesCategory>("wordle");
  // New players can place on a weekly board; All time is one tap away in Filters.
  const [period, setPeriod] = useState<LeaderboardPeriod>("WEEKLY");
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
    if (trackerParam === "daily_streak" || trackerParam === "daily") {
      if (SHOW_DAILY_CHALLENGE_UI) {
        setLeaderboardMode("daily");
        setTracker("daily_streak");
        setDailyView(trackerParam === "daily_streak" ? "streak" : "today");
      } else {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
    if (trackerParam === "quiz_prize") {
      setLeaderboardMode("quiz");
      setMiniGamesCategory("quiz-prize");
    } else if (trackerParam === "quiz_wins") {
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

  const isClassicBoard = leaderboardMode === "super-league";
  const classicTracker: LeaderboardTrackerType =
    classicView === "best_season" || classicView === "total_record" ? "best_record" : classicView;
  const recordMetric: RecordMetric = classicView === "total_record" ? "total" : "best";
  const activeTracker =
    isMiniGamesMode
      ? tracker
      : isClassicBoard
        ? classicTracker
        : isTrackerValidForDbMode(tracker, leaderboardMode)
          ? tracker
          : getDefaultTrackerForDbMode(leaderboardMode);

  const isDailyMode =
    SHOW_DAILY_CHALLENGE_UI && leaderboardMode === "daily";
  const isTrophyCabinetMode = leaderboardMode === "trophy-cabinet";
  const activeMiniGamesCategory =
    PUZZLES_CATEGORIES.find((c) => c.id === miniGamesCategory) ??
    PUZZLES_CATEGORIES[0]!;
  const isQuizPrizeBoard = miniGamesCategory === "quiz-prize";

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
        const result =
          miniGamesCategory === "quiz-prize"
            ? await getQuizLeaderboardAsync()
            : await getMiniGameWinsLeaderboardAsync(miniGamesCategory);
        if (currentRequest !== requestId.current) return;
        setEntries(result.rows);
        setUsingFallback(result.source === "local");
        return;
      }

      if (isDailyMode || isTrophyCabinetMode) {
        const result = isDailyMode
          ? dailyView === "today"
            ? await getDailyScoreLeaderboardAsync()
            : await getDailyLeaderboardAsync()
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
        isSuperLeagueMode ? superLeagueModeVariant : "current",
        isSuperLeagueMode ? recordMetric : "total"
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
    dailyView,
    recordMetric,
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
          ? "Puzzles"
          : "Classic";

  const classicViews: { id: ClassicView; label: string }[] = [
    { id: "best_season", label: "Best season" },
    { id: "total_record", label: "Total record" },
    ...getTrackersForDbMode("super-league")
      .filter((t) => t.id !== "best_record")
      .map((t) => ({ id: t.id as ClassicView, label: t.label })),
  ];

  const trackerLabel = isDailyMode
    ? DAILY_VIEWS.find((v) => v.id === dailyView)!.label
    : isClassicBoard
      ? classicViews.find((v) => v.id === classicView)?.label ?? "Best season"
      : isMiniGamesMode
    ? activeMiniGamesCategory.label
    : isTrophyCabinetMode
      ? (TROPHY_CABINET_CATEGORIES.find((c) => c.logicalId === trophyLogicalId)
          ?.label ?? "Leaderboard")
      : (availableTrackers.find((t) => t.id === activeTracker)?.label ??
        "Leaderboard");

  const statColumnLabel = isMiniGamesMode
    ? isQuizPrizeBoard
      ? "Best Prize"
      : miniGamesCategory === "grid"
        ? "Perfect Grids"
        : "Total Wins"
    : isDailyMode
      ? dailyView === "today"
        ? "Score"
        : "Best Streak"
      : isClassicBoard && activeTracker === "best_record"
        ? recordMetric === "best"
          ? "Best Season"
          : "Total Record"
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
    { id: "quiz" as const, label: "Puzzles" },
  ];

  const emptyStateTitle = isDailyMode
    ? dailyView === "today"
      ? "Be the first on today's board"
      : "No streaks yet"
    : isMiniGamesMode
      ? "No entries yet"
      : period === "WEEKLY"
        ? "Be the first on this week's board"
        : period === "MONTHLY"
          ? "Be the first on this month's board"
          : "No entries yet";
  const emptyStateMessage = isDailyMode
    ? dailyView === "today"
      ? `Play today's Daily: every win scores 10, top the table +50, play-off wins 15 and the Grand Final +100 (max ${DAILY_MAX_SCORE}).`
      : "Finish the Daily on back-to-back days to build a streak."
    : isQuizPrizeBoard
      ? "No prizes banked yet. Play the Golden Point Quiz to climb the board."
      : isMiniGamesMode
      ? `No ${activeMiniGamesCategory.label.toLowerCase()} yet. Win a game to climb the board.`
      : period === "ALL_TIME"
        ? "Finish a Classic season to get on the board."
        : "Finish a Classic season this week to get on the board.";

  const showUpdatedColumn =
    !isDailyMode && !isTrophyCabinetMode && !isMiniGamesMode;

  const showPeriodFilters =
    !isDailyMode && !isTrophyCabinetMode && !isMiniGamesMode;
  const periodLabel = formatPeriodLabel(period);
  const filterSummary = isDailyMode
    ? trackerLabel
    : isClassicBoard
      ? `${trackerLabel} · ${periodLabel} · ${normalEraMode ? "Era" : "Current"}`
      : trackerLabel;

  const hiddenIds = useHiddenCoachIds();
  // Coaches you hid don't show on your boards (their rank numbers stay as they are).
  const visibleEntries = entries.filter((e) => e.isCurrentUser || !e.userId || !hiddenIds.has(e.userId));
  const hiddenCount = entries.length - visibleEntries.length;
  const reportBoard: ReportBoard = isDailyMode
    ? "daily"
    : isTrophyCabinetMode
      ? "trophies"
      : isMiniGamesMode
        ? "puzzles"
        : "classic";
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

      {isDailyMode ? <DailyStreakStrip className="mb-4" /> : null}

      {/* One summary row; every other filter lives in the sheet (was four rows of tabs). */}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-control bg-pitch-900 px-3 py-2">
        <p className="min-w-0 truncate text-sm font-semibold text-gray-200" aria-live="polite">
          {filterSummary}
        </p>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="btn-press shrink-0 rounded-full border border-pitch-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-pitch-800 min-h-[36px]"
          aria-haspopup="dialog"
        >
          Filters
        </button>
      </div>

      <GameModal open={filtersOpen} onClose={() => setFiltersOpen(false)} labelledBy="leaderboard-filters-title">
        <h2 id="leaderboard-filters-title" className={`text-center ${TYPO.sectionTitle}`}>
          {modeLabel} filters
        </h2>
        <div className="mt-4 space-y-5">
          {isDailyMode ? (
            <section aria-label="Daily board">
              <p className={`mb-2 ${TYPO.meta}`}>Rank by</p>
              <LeaderboardTabBar
                tier="category"
                tabs={DAILY_VIEWS.map((v) => ({ id: v.id, label: v.label, accent: "amber" as const }))}
                active={dailyView}
                onChange={(id) => setDailyView(id as DailyView)}
                ariaLabel="Daily board"
              />
            </section>
          ) : null}

          {isClassicBoard ? (
            <section aria-label="Ranking">
              <p className={`mb-2 ${TYPO.meta}`}>Rank by</p>
              <LeaderboardTabBar
                tier="category"
                tabs={classicViews.map((v) => ({
                  id: v.id,
                  label: v.label,
                  accent: v.id === "best_season" || v.id === "total_record" ? "theme" : TRACKER_ACCENTS[v.id as LeaderboardTrackerType],
                }))}
                active={classicView}
                onChange={(id) => setClassicView(id as ClassicView)}
                ariaLabel="Ranking"
              />
            </section>
          ) : null}
          {showCupVariantToggle && (
        <div>
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

      <div>
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
            tabs={PUZZLES_CATEGORIES.map((category) => ({
              id: category.id,
              label: category.shortLabel,
              accent: MINI_GAMES_CATEGORY_ACCENTS[category.id],
            }))}
            active={miniGamesCategory}
            onChange={(id) => setMiniGamesCategory(id as PuzzlesCategory)}
            scrollable={PUZZLES_CATEGORIES.length > 4}
            ariaLabel="Puzzles category"
          />
        ) : (
          !isClassicBoard && !isDailyMode && availableTrackers.length > 1 && (
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
        <nav aria-label="Leaderboard period">
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

          {showPeriodFilters ? (
            <p className={`text-center ${TYPO.meta}`}>
              This week and this month list coaches who played in that period.
            </p>
          ) : null}
        </div>
        <div className="mt-5">
          <GameButton variant="theme" onClick={() => setFiltersOpen(false)}>
            Show results
          </GameButton>
        </div>
      </GameModal>

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
            title={emptyStateTitle}
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
                    ? "Play today's Daily"
                    : isMiniGamesMode
                      ? `Play ${activeMiniGamesCategory.shortLabel}`
                      : "Play Classic"}
                </GameButton>
                {isClassicBoard && period !== "ALL_TIME" ? (
                  <GameButton
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    onClick={() => setPeriod("ALL_TIME")}
                  >
                    See all time
                  </GameButton>
                ) : null}
                {!authLoading && !isLoggedIn ? (
                  <GameButton
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    href={
                      isDailyMode
                        ? "/login?redirect=/leaderboard?tracker=daily"
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
            {visibleEntries.map((entry) => {
              const flair = flairFor(entry);
              const shownName = displayCoachName(entry.username, entry.userId);
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
                  <span className="flex min-w-0 items-center gap-1">
                    <CoachNameplate className={TYPO.identityLine} name={shownName} title={flair.title} />
                    {!entry.isCurrentUser && !usingFallback ? (
                      <span className="ml-auto">
                        <CoachRowActions
                          userId={entry.userId}
                          coachName={entry.username}
                          displayName={shownName}
                          board={reportBoard}
                        />
                      </span>
                    ) : null}
                  </span>
                  <span className="whitespace-nowrap text-right font-semibold leading-tight text-accent-gold">
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

      <HiddenCoachesNote count={hiddenCount} />
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
        <RecordWithPercentage wins={parsed.wins} losses={parsed.losses} stacked />
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
