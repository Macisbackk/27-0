"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameDifficulty, LeaderboardPeriod } from "@/lib/types";
import { formatPeriodLabel } from "@/lib/leaderboard";
import {
  getDefaultTrackerForDbMode,
  getDefaultTrackerForManagerDbMode,
  getTrackersForDbMode,
  getTrackersForManagerDbMode,
  getTrophyCabinetLogicalId,
  isTrackerValidForDbMode,
  isTrackerValidForManagerDbMode,
  resolveTrophyCabinetTracker,
  TROPHY_CABINET_CATEGORIES,
  type LeaderboardTrackerRow,
  type LeaderboardTrackerType,
  type ManagerLeaderboardDbMode,
  type TrophyCabinetSection,
} from "@/lib/leaderboard-trackers";
import {
  getTrackerLeaderboardAsync,
  type LeaderboardDbMode,
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
  getManagerLeaderboardAsync,
  MANAGER_LEADERBOARD_MODES,
} from "@/lib/storage/manager-leaderboard";
import { RecordWithPercentage, parseRecordWithPercentage } from "./RecordWithPercentage";
import { GamePanel } from "@/components/ui/GamePanel";
import { GameEmptyState } from "@/components/ui/GameEmptyState";
import { GameButton } from "@/components/ui/GameButton";
import { ScoreboardPanel } from "@/components/ui/ScoreboardPanel";
import { useAuth } from "@/lib/auth-context";

const PERIODS: LeaderboardPeriod[] = ["WEEKLY", "MONTHLY", "ALL_TIME"];

type LeaderboardPlayStyle = "quick" | "manager";

const PLAY_STYLE_TABS: { id: LeaderboardPlayStyle; label: string }[] = [
  { id: "manager", label: "Manager Mode" },
  { id: "quick", label: "Quick Mode" },
];

const QUICK_MODE_ACCENTS = {
  "super-league": "green",
  "trophy-cabinet": "gold",
  daily: "amber",
} as const satisfies Partial<Record<LeaderboardDbMode, LeaderboardTabAccent>>;

const MANAGER_MODE_ACCENTS: Record<
  ManagerLeaderboardDbMode,
  LeaderboardTabAccent
> = {
  "manager-super-league": "theme",
  "manager-championship": "sky",
  "manager-challenge-cup": "gold",
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
  manager_challenge_cups: "gold",
  manager_cup_finals: "gold",
  manager_league_titles: "theme",
  manager_championship_titles: "sky",
  manager_super_league_champions: "gold",
  manager_seasons_completed: "sky",
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
  manager_challenge_cups: "Cups Won",
  manager_cup_finals: "Finals Reached",
  manager_league_titles: "SL Titles",
  manager_championship_titles: "Champ Titles",
  manager_super_league_champions: "SL Champions",
  manager_seasons_completed: "Seasons Completed",
};

type QuickLeaderboardMode = "super-league" | "trophy-cabinet" | "daily";

export function LeaderboardTable() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [playStyle, setPlayStyle] = useState<LeaderboardPlayStyle>("manager");
  const [leaderboardMode, setLeaderboardMode] =
    useState<QuickLeaderboardMode>("super-league");
  const [managerMode, setManagerMode] =
    useState<ManagerLeaderboardDbMode>("manager-super-league");
  const [tracker, setTracker] = useState<LeaderboardTrackerType>("best_record");
  const [period, setPeriod] = useState<LeaderboardPeriod>("ALL_TIME");
  const difficulty: GameDifficulty = "NORMAL";
  const [entries, setEntries] = useState<LeaderboardTrackerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [normalEraMode, setNormalEraMode] = useState(false);
  const requestId = useRef(0);

  const isManagerPlayStyle = playStyle === "manager";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const trackerParam = params.get("tracker");
    if (trackerParam === "daily_streak") {
      setPlayStyle("quick");
      setLeaderboardMode("daily");
      setTracker("daily_streak");
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

  const availableTrackers = isManagerPlayStyle
    ? getTrackersForManagerDbMode(managerMode)
    : getTrackersForDbMode(leaderboardMode);

  const activeTracker = isManagerPlayStyle
    ? isTrackerValidForManagerDbMode(tracker, managerMode)
      ? tracker
      : getDefaultTrackerForManagerDbMode(managerMode)
    : isTrackerValidForDbMode(tracker, leaderboardMode)
      ? tracker
      : getDefaultTrackerForDbMode(leaderboardMode);

  const isDailyMode = !isManagerPlayStyle && leaderboardMode === "daily";
  const isTrophyCabinetMode =
    !isManagerPlayStyle && leaderboardMode === "trophy-cabinet";

  const handlePlayStyleChange = (style: LeaderboardPlayStyle) => {
    setPlayStyle(style);
    if (style === "manager") {
      setManagerMode("manager-super-league");
      setTracker(getDefaultTrackerForManagerDbMode("manager-super-league"));
    } else {
      setLeaderboardMode("super-league");
      setTracker(getDefaultTrackerForDbMode("super-league"));
    }
  };

  const handleQuickModeChange = (mode: QuickLeaderboardMode) => {
    setLeaderboardMode(mode);
    setTracker(getDefaultTrackerForDbMode(mode));
  };

  const handleManagerModeChange = (mode: ManagerLeaderboardDbMode) => {
    setManagerMode(mode);
    setTracker(getDefaultTrackerForManagerDbMode(mode));
  };

  const isSuperLeagueMode =
    !isManagerPlayStyle && leaderboardMode === "super-league";
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
      if (isManagerPlayStyle) {
        const result = await getManagerLeaderboardAsync(
          managerMode,
          activeTracker,
          50
        );
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
    managerMode,
    activeTracker,
    effectiveTracker,
    isDailyMode,
    isTrophyCabinetMode,
    isSuperLeagueMode,
    superLeagueModeVariant,
    isManagerPlayStyle,
    normalEraMode,
  ]);

  useEffect(() => {
    if (isManagerPlayStyle) {
      if (!isTrackerValidForManagerDbMode(tracker, managerMode)) {
        setTracker(getDefaultTrackerForManagerDbMode(managerMode));
      }
      return;
    }
    if (isTrophyCabinetMode) {
      const logical = getTrophyCabinetLogicalId(tracker) ?? "league_titles";
      const resolved = resolveTrophyCabinetTracker(logical, trophySection);
      if (tracker !== resolved) {
        setTracker(resolved);
      }
      return;
    }
    if (!isTrackerValidForDbMode(tracker, leaderboardMode)) {
      setTracker(getDefaultTrackerForDbMode(leaderboardMode));
    }
  }, [
    leaderboardMode,
    managerMode,
    tracker,
    isManagerPlayStyle,
    isTrophyCabinetMode,
    trophySection,
  ]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const quickModeLabel =
    leaderboardMode === "daily"
      ? "Daily"
      : leaderboardMode === "trophy-cabinet"
        ? "Trophy Cabinet"
        : "Quick Mode";

  const managerModeLabel =
    MANAGER_LEADERBOARD_MODES.find((mode) => mode.id === managerMode)?.label ??
    "Manager Mode";

  const modeLabel = isManagerPlayStyle ? managerModeLabel : quickModeLabel;

  const trackerLabel = isTrophyCabinetMode
    ? (TROPHY_CABINET_CATEGORIES.find((c) => c.logicalId === trophyLogicalId)
        ?.label ?? "Leaderboard")
    : (availableTrackers.find((t) => t.id === activeTracker)?.label ??
      "Leaderboard");

  const statColumnLabel =
    isManagerPlayStyle && effectiveTracker === "best_record"
      ? "Best Record"
      : (STAT_COLUMN[effectiveTracker] ?? "Stat");

  const quickModeOptions = [
    { id: "super-league" as const, label: "Quick Mode" },
    { id: "trophy-cabinet" as const, label: "Trophy Cabinet" },
    { id: "daily" as const, label: "Daily" },
  ] as const;

  const managerModeOptions = MANAGER_LEADERBOARD_MODES;

  const emptyStateMessage = isManagerPlayStyle
    ? `No ${trackerLabel.toLowerCase()} entries yet. Finish a manager season.`
    : isDailyMode
      ? "No streaks yet. Finish a Daily Challenge."
      : `No ${trackerLabel.toLowerCase()} entries yet. Finish a run.`;

  const showUpdatedColumn = !isDailyMode && !isTrophyCabinetMode;

  const showPeriodFilters =
    !isManagerPlayStyle && !isDailyMode && !isTrophyCabinetMode;

  return (
    <div>
      <nav className="mb-5" aria-label="Leaderboard play style">
        <LeaderboardTabBar
          tier="playStyle"
          tabs={PLAY_STYLE_TABS}
          active={playStyle}
          onChange={handlePlayStyleChange}
          ariaLabel="Leaderboard play style"
        />
      </nav>

      {(() => {
        const modeOptions = isManagerPlayStyle
          ? managerModeOptions
          : quickModeOptions;
        const modeNavLabel = isManagerPlayStyle
          ? "Manager leaderboard modes"
          : "Quick mode leaderboards";

        return (
          <nav className="mb-5" aria-label={modeNavLabel}>
            <LeaderboardTabBar
              tier="mode"
              tabs={modeOptions.map((mode) => ({
                id: mode.id,
                label: mode.label,
                accent: isManagerPlayStyle
                  ? MANAGER_MODE_ACCENTS[mode.id as ManagerLeaderboardDbMode]
                  : QUICK_MODE_ACCENTS[mode.id as keyof typeof QUICK_MODE_ACCENTS],
              }))}
              active={
                isManagerPlayStyle
                  ? managerMode
                  : leaderboardMode
              }
              onChange={(id) => {
                if (isManagerPlayStyle) {
                  handleManagerModeChange(id as ManagerLeaderboardDbMode);
                } else {
                  handleQuickModeChange(id as QuickLeaderboardMode);
                }
              }}
              ariaLabel={modeNavLabel}
            />
          </nav>
        );
      })()}

      {showCupVariantToggle && (
        <div className="mb-5">
          <ChallengeCupVariantToggle
            sectionLabel={isTrophyCabinetMode ? "Trophy Mode" : "Mode Variant"}
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
                  href={isManagerPlayStyle ? "/manager" : "/play"}
                >
                  {isManagerPlayStyle ? "Play Manager Mode" : "Play Quick Mode"}
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
                    className={`shrink-0 font-bold tabular-nums ${
                      entry.rank <= 3 ? "text-accent-gold" : "text-gray-400"
                    }`}
                  >
                    {entry.rank}
                  </span>
                  <span className="truncate font-medium">{entry.username}</span>
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
                      className={`font-bold ${
                        entry.rank <= 3 ? "text-accent-gold" : "text-gray-400"
                      }`}
                    >
                      {entry.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{entry.username}</span>
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
        {isManagerPlayStyle ? "Manager Mode" : "Quick Mode"}
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
