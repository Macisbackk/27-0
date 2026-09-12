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
import { GameButton } from "@/components/ui/GameButton";
import { ScoreboardPanel } from "@/components/ui/ScoreboardPanel";
import { TYPO } from "@/lib/ui/typography";
import { useAuth } from "@/lib/auth-context";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";

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
  league_titles: "League Titles",
  super_league_champions: "SL Champions",
  era_league_title: "League Titles",
  era_league_champions: "SL Champions",
  daily_streak: "Best Streak",
};

type QuickLeaderboardMode = "super-league" | "trophy-cabinet" | "daily" | "quiz";

export function LeaderboardTable() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [leaderboardMode, setLeaderboardMode] =
    useState<QuickLeaderboardMode>("super-league");
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
        ? "Trophy Cabinet"
        : isMiniGamesMode
          ? "Mini Games"
          : "Quick Mode";

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
    { id: "super-league" as const, label: "Quick Mode" },
    { id: "trophy-cabinet" as const, label: "Trophy Cabinet" },
    ...(SHOW_DAILY_CHALLENGE_UI
      ? [{ id: "daily" as const, label: "Daily" }]
      : []),
    { id: "quiz" as const, label: "Mini Games" },
  ];

  const emptyStateMessage = isDailyMode
    ? "No streaks yet. Finish a Daily Challenge."
    : isMiniGamesMode
      ? `No ${activeMiniGamesCategory.label.toLowerCase()} yet. Win a game to climb the board.`
      : `No ${trackerLabel.toLowerCase()} entries yet. Finish a run.`;

  const showUpdatedColumn =
    !isDailyMode && !isTrophyCabinetMode && !isMiniGamesMode;

  const showPeriodFilters =
    !isDailyMode && !isTrophyCabinetMode && !isMiniGamesMode;

  return (
    <div>
      <nav className="mb-5" aria-label="Quick mode leaderboards">
        <LeaderboardTabBar
          tier="mode"
          tabs={quickModeOptions.map((mode) => ({
            id: mode.id,
            label: mode.label,
            accent: QUICK_MODE_ACCENTS[mode.id],
          }))}
          active={leaderboardMode}
          onChange={(id) => handleQuickModeChange(id as QuickLeaderboardMode)}
          ariaLabel="Quick mode leaderboards"
        />
      </nav>

      {showCupVariantToggle && (
        <div className="mb-5">
          <ChallengeCupVariantToggle
            sectionLabel={isTrophyCabinetMode ? "Trophy Mode" : "Mode"}
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
                    isMiniGamesMode
                      ? activeMiniGamesCategory.href
                      : "/play"
                  }
                >
                  {isMiniGamesMode
                    ? `Play ${activeMiniGamesCategory.shortLabel}`
                    : "Play Quick Mode"}
                </GameButton>
                {!authLoading && !isLoggedIn ? (
                  <GameButton
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    href="/login?redirect=/leaderboard"
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
          <ul
            className="divide-y divide-pitch-700/30 sm:hidden"
            aria-label={`${trackerLabel} rankings`}
          >
            {entries.map((entry) => (
              <li
                key={`mobile-${entry.rank}-${entry.username}-${entry.achievedAt}`}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  entry.isCurrentUser ? "bg-theme-primary/5" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`shrink-0 font-display font-bold tabular-nums ${
                      entry.rank <= 3 ? "text-accent-gold" : "text-gray-400"
                    }`}
                  >
                    {entry.rank}
                  </span>
                  <span className={`truncate ${TYPO.identityLine}`}>{entry.username}</span>
                </div>
                <div className="shrink-0 text-right font-semibold text-accent-gold">
                  {renderLeaderboardStat(entry, effectiveTracker)}
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-pitch-600/50 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Coach</th>
                <th className="px-4 py-3">
                  {statColumnLabel}
                </th>
                {showUpdatedColumn && (
                  <th className="hidden px-4 py-3 sm:table-cell">Updated</th>
                )}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={`${entry.rank}-${entry.username}-${entry.achievedAt}`}
                  className={`border-b border-pitch-700/30 transition hover:bg-pitch-800/30 ${
                    entry.isCurrentUser ? "bg-theme-primary/5" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <span
                      className={`font-display font-bold tabular-nums ${
                        entry.rank <= 3 ? "text-accent-gold" : "text-gray-400"
                      }`}
                    >
                      {entry.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={TYPO.identityLine}>{entry.username}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-accent-gold">
                    {renderLeaderboardStat(entry, effectiveTracker)}
                  </td>
                  {showUpdatedColumn && (
                    <td className="hidden px-4 py-3 text-sm text-gray-500 sm:table-cell">
                      {entry.achievedAt
                        ? new Date(entry.achievedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </ScoreboardPanel>
      )}

      <p className="mt-4 text-center text-xs text-gray-600">
        {usingFallback
          ? "Showing local fallback · online sync unavailable"
          : "Updated online across all players"}
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
