"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameDifficulty, LeaderboardPeriod } from "@/lib/types";
import { formatPeriodLabel } from "@/lib/leaderboard";
import {
  getDefaultTrackerForDbMode,
  getDefaultTrackerForManagerDbMode,
  getTrackersForDbMode,
  getTrackersForManagerDbMode,
  isTrackerValidForDbMode,
  isTrackerValidForManagerDbMode,
  TROPHY_CABINET_SECTIONS,
  type LeaderboardTrackerRow,
  type LeaderboardTrackerType,
  type ManagerLeaderboardDbMode,
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
import { getClubFundsLeaderboardAsync } from "@/lib/storage/club-funds-leaderboard";
import {
  getManagerLeaderboardAsync,
  MANAGER_LEADERBOARD_MODES,
} from "@/lib/storage/manager-leaderboard";
import { RecordWithPercentage, parseRecordWithPercentage } from "./RecordWithPercentage";
import { TYPO } from "@/lib/ui/typography";

const PERIODS: LeaderboardPeriod[] = ["WEEKLY", "MONTHLY", "ALL_TIME"];

type LeaderboardPlayStyle = "quick" | "manager";

const PLAY_STYLE_TABS: { id: LeaderboardPlayStyle; label: string }[] = [
  { id: "manager", label: "Manager Mode" },
  { id: "quick", label: "Quick Mode" },
];

const QUICK_MODE_ACCENTS = {
  "super-league": "green",
  "trophy-cabinet": "gold",
  "club-funds": "sky",
} as const satisfies Partial<Record<LeaderboardDbMode, LeaderboardTabAccent>>;

const MANAGER_MODE_ACCENTS: Record<
  ManagerLeaderboardDbMode,
  LeaderboardTabAccent
> = {
  "manager-super-league": "green",
  "manager-challenge-cup": "gold",
  "manager-earnings": "sky",
};

const TRACKER_ACCENTS: Partial<
  Record<LeaderboardTrackerType, LeaderboardTabAccent>
> = {
  perfect_runs: "green",
  winless_seasons: "amber",
  best_record: "theme",
  league_titles: "green",
  super_league_champions: "gold",
  era_league_title: "green",
  era_league_champions: "gold",
  total_winnings: "sky",
  manager_challenge_cups: "gold",
  manager_cup_finals: "gold",
  manager_league_titles: "green",
  manager_total_earnings: "sky",
};

const STAT_COLUMN: Partial<Record<LeaderboardTrackerType, string>> = {
  perfect_runs: "27-0 Seasons",
  winless_seasons: "0-27 Seasons",
  best_record: "Total Record",
  league_titles: "League Titles",
  super_league_champions: "SL Champions",
  era_league_title: "Era League Titles",
  era_league_champions: "Era Champions",
  total_winnings: "Total Winnings",
  manager_challenge_cups: "Cups Won",
  manager_cup_finals: "Finals Reached",
  manager_league_titles: "League Titles",
  manager_total_earnings: "Total Earnings",
};

export function LeaderboardTable() {
  const [playStyle, setPlayStyle] = useState<LeaderboardPlayStyle>("manager");
  const [leaderboardMode, setLeaderboardMode] =
    useState<LeaderboardDbMode>("super-league");
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

  const isClubFundsMode =
    !isManagerPlayStyle && leaderboardMode === "club-funds";
  const isTrophyCabinetMode =
    !isManagerPlayStyle && leaderboardMode === "trophy-cabinet";
  const isManagerEarningsMode =
    isManagerPlayStyle && managerMode === "manager-earnings";
  const isManagerScoreMode = isManagerEarningsMode;

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

  const handleQuickModeChange = (mode: LeaderboardDbMode) => {
    setLeaderboardMode(mode);
    setTracker(getDefaultTrackerForDbMode(mode));
  };

  const handleManagerModeChange = (mode: ManagerLeaderboardDbMode) => {
    setManagerMode(mode);
    setTracker(getDefaultTrackerForManagerDbMode(mode));
  };

  const isSuperLeagueMode =
    !isManagerPlayStyle && leaderboardMode === "super-league";
  const showCupVariantToggle = isSuperLeagueMode;
  const superLeagueModeVariant = normalEraMode ? "era" : "current";

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

      if (isClubFundsMode || isTrophyCabinetMode) {
        const result = isClubFundsMode
          ? await getClubFundsLeaderboardAsync()
          : await getTrackerLeaderboardAsync(
              activeTracker,
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
    isClubFundsMode,
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
    if (!isTrackerValidForDbMode(tracker, leaderboardMode)) {
      setTracker(getDefaultTrackerForDbMode(leaderboardMode));
    }
  }, [leaderboardMode, managerMode, tracker, isManagerPlayStyle]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const quickModeLabel =
    leaderboardMode === "club-funds"
      ? "Total Winnings"
      : leaderboardMode === "trophy-cabinet"
        ? "Trophy Cabinet"
        : "Quick Mode";

  const managerModeLabel =
    MANAGER_LEADERBOARD_MODES.find((mode) => mode.id === managerMode)?.label ??
    "Manager Mode";

  const modeLabel = isManagerPlayStyle ? managerModeLabel : quickModeLabel;

  const trackerLabel =
    availableTrackers.find((t) => t.id === activeTracker)?.label ??
    "Leaderboard";

  const quickModeOptions = [
    { id: "super-league" as const, label: "Quick Mode" },
    { id: "trophy-cabinet" as const, label: "Trophy Cabinet" },
    { id: "club-funds" as const, label: "Total Winnings" },
  ] as const;

  const emptyStateMessage = isManagerPlayStyle
    ? `No ${trackerLabel.toLowerCase()} entries yet. Complete a manager season to appear on the leaderboard!`
    : `No ${trackerLabel.toLowerCase()} entries yet. Complete a run to appear on the leaderboard!`;

  const showUpdatedColumn =
    !isClubFundsMode &&
    !isTrophyCabinetMode &&
    !isManagerScoreMode;

  const showPeriodFilters =
    !isManagerPlayStyle &&
    !isClubFundsMode &&
    !isTrophyCabinetMode;

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
          ? MANAGER_LEADERBOARD_MODES
          : quickModeOptions;
        const modeLabel = isManagerPlayStyle
          ? "Manager leaderboard modes"
          : "Quick mode leaderboards";

        return (
          <nav className="mb-5" aria-label={modeLabel}>
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
                  handleQuickModeChange(id as LeaderboardDbMode);
                }
              }}
              ariaLabel={modeLabel}
            />
          </nav>
        );
      })()}

      {showCupVariantToggle && (
        <div className="mb-5">
          <ChallengeCupVariantToggle
            sectionLabel="Mode Variant"
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
          <div className="space-y-4">
            {TROPHY_CABINET_SECTIONS.map((section) => {
              const sectionTrackers = availableTrackers.filter((t) =>
                section.trackerIds.includes(t.id)
              );
              if (sectionTrackers.length === 0) return null;

              return (
                <div key={section.id}>
                  <p className={`mb-2 ${TYPO.sectionLabel} text-pitch-500`}>
                    {section.label}
                  </p>
                  <LeaderboardTabBar
                    tier="category"
                    tabs={sectionTrackers.map((t) => ({
                      id: t.id,
                      label: t.shortLabel,
                      accent: TRACKER_ACCENTS[t.id],
                    }))}
                    active={activeTracker}
                    onChange={(id) => setTracker(id)}
                    scrollable={sectionTrackers.length > 4}
                    ariaLabel={section.label}
                  />
                </div>
              );
            })}
          </div>
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
        <div className="matchday-panel p-12 text-center text-gray-500">
          Loading leaderboard…
        </div>
      ) : entries.length === 0 ? (
        <div className="matchday-panel p-12 text-center text-gray-500">
          {emptyStateMessage}
        </div>
      ) : (
        <div
          className={`matchday-panel overflow-hidden transition-opacity ${
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
                  entry.isCurrentUser ? "bg-accent-green/5" : ""
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
                  {renderLeaderboardStat(entry, activeTracker)}
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
                  {STAT_COLUMN[activeTracker] ?? "Stat"}
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
                    entry.isCurrentUser ? "bg-accent-green/5" : ""
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
                    {renderLeaderboardStat(entry, activeTracker)}
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
        </div>
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
