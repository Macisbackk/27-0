"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameDifficulty, LeaderboardPeriod } from "@/lib/types";
import { formatPeriodLabel } from "@/lib/leaderboard";
import {
  getDefaultTrackerForDbMode,
  getTrackersForDbMode,
  isTrackerValidForDbMode,
  type LeaderboardTrackerRow,
  type LeaderboardTrackerType,
} from "@/lib/leaderboard-trackers";
import {
  getTrackerLeaderboardAsync,
  type LeaderboardDbMode,
} from "@/lib/storage/leaderboard";
import {
  getCupTeamWinsLeaderboardAsync,
  getEraCupTeamWinsLeaderboardRows,
  type CupTeamWinsLeaderboardRow,
} from "@/lib/storage/cup-team-wins";
import {
  CUP_ERA_VARIANT_CHANGED_EVENT,
  getCupEraVariant,
  getNormalEraVariant,
  setCupEraVariant,
  setNormalEraVariant,
  NORMAL_ERA_VARIANT_CHANGED_EVENT,
} from "@/lib/storage/preferences";
import { ChallengeCupVariantToggle } from "./ChallengeCupVariantToggle";
import { getClubFundsLeaderboardAsync } from "@/lib/storage/club-funds-leaderboard";
import { playTabChange } from "@/lib/sound";
import { RecordWithPercentage } from "./RecordWithPercentage";
import { CupTeamWinsBarGraph } from "./CupTeamWinsBarGraph";
import { HardModeBadge } from "./HardModeBadge";
import {
  BTN,
  CARD,
  SPACING,
  tabGroupButtonClass,
  tabGroupClass,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { SHOW_DRAFT_MODE } from "@/lib/feature-flags";

const PERIODS: LeaderboardPeriod[] = ["WEEKLY", "MONTHLY", "ALL_TIME"];

const STAT_COLUMN: Partial<Record<LeaderboardTrackerType, string>> = {
  squad_value: "Squad Value",
  most_wins: "Wins",
  perfect_runs: "27-0 Seasons",
  best_record: "Total Record",
  challenge_cup_wins: "Cups Won",
  cup_match_wins: "Cup Wins",
  challenge_cup_team_wins: "Tournament Wins",
  total_winnings: "Total Winnings",
};

interface LeaderboardTableProps {
  initialDifficulty?: GameDifficulty;
}

export function LeaderboardTable({
  initialDifficulty = "NORMAL",
}: LeaderboardTableProps) {
  const [leaderboardMode, setLeaderboardMode] =
    useState<LeaderboardDbMode>("super-league");
  const [tracker, setTracker] = useState<LeaderboardTrackerType>("best_record");
  const [period, setPeriod] = useState<LeaderboardPeriod>("ALL_TIME");
  const [difficulty, setDifficulty] =
    useState<GameDifficulty>(initialDifficulty);
  const [entries, setEntries] = useState<LeaderboardTrackerRow[]>([]);
  const [teamWinsRows, setTeamWinsRows] = useState<CupTeamWinsLeaderboardRow[]>(
    []
  );
  const [teamWinsTotal, setTeamWinsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [cupEraMode, setCupEraMode] = useState(false);
  const [normalEraMode, setNormalEraMode] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    setCupEraMode(getCupEraVariant());
    setNormalEraMode(getNormalEraVariant());
    const onCupEra = (event: Event) => {
      const detail = (event as CustomEvent<{ eraMode: boolean }>).detail;
      if (detail) setCupEraMode(detail.eraMode);
    };
    const onNormalEra = (event: Event) => {
      const detail = (event as CustomEvent<{ eraMode: boolean }>).detail;
      if (detail) setNormalEraMode(detail.eraMode);
    };
    window.addEventListener(CUP_ERA_VARIANT_CHANGED_EVENT, onCupEra);
    window.addEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onNormalEra);
    return () => {
      window.removeEventListener(CUP_ERA_VARIANT_CHANGED_EVENT, onCupEra);
      window.removeEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onNormalEra);
    };
  }, []);

  const availableTrackers = getTrackersForDbMode(leaderboardMode);
  const activeTracker = isTrackerValidForDbMode(tracker, leaderboardMode)
    ? tracker
    : getDefaultTrackerForDbMode(leaderboardMode);
  const isTeamWinsTracker = activeTracker === "challenge_cup_team_wins";
  const isClubFundsMode = leaderboardMode === "club-funds";

  const handleModeChange = (mode: LeaderboardDbMode) => {
    if (mode !== leaderboardMode) playTabChange();
    setLeaderboardMode(mode);
    setTracker(getDefaultTrackerForDbMode(mode));
    if (mode === "challenge-cup" || mode === "fantasy" || mode === "club-funds") {
      setDifficulty("NORMAL");
    }
  };

  const isChallengeCupMode = leaderboardMode === "challenge-cup";
  const isSuperLeagueMode = leaderboardMode === "super-league";
  const superLeagueModeVariant = normalEraMode ? "era" : "current";

  const loadEntries = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);

    try {
      if (isClubFundsMode) {
        const result = await getClubFundsLeaderboardAsync();
        if (currentRequest !== requestId.current) return;
        setEntries(result.rows);
        setTeamWinsRows([]);
        setTeamWinsTotal(0);
        setUsingFallback(result.source === "local");
        return;
      }

      if (isTeamWinsTracker) {
        if (isChallengeCupMode && cupEraMode) {
          const rows = getEraCupTeamWinsLeaderboardRows();
          const totalCups = rows.reduce(
            (sum, row) => sum + row.tournamentWins,
            0
          );
          if (currentRequest !== requestId.current) return;
          setTeamWinsRows(rows);
          setTeamWinsTotal(totalCups);
          setEntries([]);
          setUsingFallback(true);
          return;
        }

        const result = await getCupTeamWinsLeaderboardAsync();
        if (currentRequest !== requestId.current) return;
        setTeamWinsRows(result.rows);
        setTeamWinsTotal(result.totalCups);
        setEntries([]);
        setUsingFallback(result.source === "local");
        return;
      }

      const cupModeVariant =
        isChallengeCupMode && cupEraMode ? "era" : "current";

      const result = await getTrackerLeaderboardAsync(
        activeTracker,
        period,
        difficulty,
        50,
        leaderboardMode,
        isSuperLeagueMode
          ? superLeagueModeVariant
          : isChallengeCupMode
            ? cupModeVariant
            : "current"
      );

      if (currentRequest !== requestId.current) return;

      setEntries(result.rows);
      setTeamWinsRows([]);
      setTeamWinsTotal(0);
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
    isTeamWinsTracker,
    isClubFundsMode,
    isChallengeCupMode,
    cupEraMode,
    isSuperLeagueMode,
    superLeagueModeVariant,
    normalEraMode,
  ]);

  useEffect(() => {
    if (!isTrackerValidForDbMode(tracker, leaderboardMode)) {
      setTracker(getDefaultTrackerForDbMode(leaderboardMode));
    }
  }, [leaderboardMode, tracker]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const modeLabel =
    leaderboardMode === "draft"
      ? "Draft Mode"
      : leaderboardMode === "challenge-cup"
        ? "Challenge Cup"
        : leaderboardMode === "fantasy"
          ? "Fantasy Mode"
          : leaderboardMode === "club-funds"
            ? "Total Winnings"
            : "Normal Mode";

  const trackerLabel =
    availableTrackers.find((t) => t.id === activeTracker)?.label ??
    "Leaderboard";

  const modeOptions = (
    [
      { id: "super-league" as const, label: "Normal Mode" },
      { id: "challenge-cup" as const, label: "Challenge Cup" },
      { id: "club-funds" as const, label: "Total Winnings" },
    ] as const
  );

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {modeOptions.map((mode) => {
          const selected = leaderboardMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleModeChange(mode.id)}
              className={`btn-press min-h-[44px] rounded-xl border-2 px-4 py-4 text-left transition active:scale-[0.98] ${
                selected
                  ? `${CARD.featured} border-accent-green/60 bg-accent-green/10`
                  : `${CARD.base} hover:border-pitch-500/60 hover:bg-pitch-800/40`
              }`}
            >
              <span
                className={`${TYPO.sectionTitle} sm:text-base ${
                  selected ? "text-accent-green" : "text-gray-300"
                }`}
              >
                {mode.label}
              </span>
            </button>
          );
        })}
      </div>

      {isChallengeCupMode && (
        <div className="mb-5">
          <ChallengeCupVariantToggle
            sectionLabel="Cup Variant"
            useShortLabels
            eraMode={cupEraMode}
            onEraModeChange={(era) => {
              setCupEraMode(era);
              setCupEraVariant(era);
            }}
          />
        </div>
      )}

      {isSuperLeagueMode && (
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

      <div className="mb-5 border-b border-pitch-700/60">
        {availableTrackers.length > 1 && (
        <div className="-mb-px flex gap-1 overflow-x-auto pb-px">
          {availableTrackers.map((t) => {
            const selected = activeTracker === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (activeTracker !== t.id) playTabChange();
                  setTracker(t.id);
                }}
                className={`shrink-0 min-h-[40px] border-b-2 px-3 py-2 ${TYPO.button} transition sm:px-4 ${
                  selected
                    ? "border-accent-green text-accent-green"
                    : "border-transparent text-gray-500 hover:border-pitch-600 hover:text-gray-300"
                }`}
              >
                {t.shortLabel}
              </button>
            );
          })}
        </div>
        )}
      </div>

      {!isTeamWinsTracker && !isClubFundsMode && (
        <div className="mb-6 flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                if (period !== p) playTabChange();
                setPeriod(p);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                period === p
                  ? "bg-pitch-700 text-white"
                  : "bg-pitch-800/80 text-gray-500 hover:text-gray-300"
              }`}
            >
              {formatPeriodLabel(p)}
            </button>
          ))}
        </div>
      )}

      {isTeamWinsTracker ? (
        <div
          className={`transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}
        >
          {loading && teamWinsRows.length === 0 ? (
            <div className="matchday-panel p-12 text-center text-gray-500">
              Loading leaderboard…
            </div>
          ) : (
            <CupTeamWinsBarGraph
              entries={teamWinsRows}
              totalCups={teamWinsTotal}
            />
          )}
        </div>
      ) : loading && entries.length === 0 ? (
        <div className="matchday-panel p-12 text-center text-gray-500">
          Loading leaderboard…
        </div>
      ) : entries.length === 0 ? (
        <div className="matchday-panel p-12 text-center text-gray-500">
          No {trackerLabel.toLowerCase()} entries yet. Complete a run to appear
          on the leaderboard!
        </div>
      ) : (
        <div
          className={`matchday-panel overflow-hidden transition-opacity ${
            loading ? "opacity-60" : "opacity-100"
          }`}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-pitch-600/50 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Coach</th>
                <th className="px-4 py-3">
                  {STAT_COLUMN[activeTracker] ?? "Stat"}
                </th>
                {!isClubFundsMode && (
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
                    {activeTracker === "best_record" ? (
                      (() => {
                        const match = entry.statDisplay.match(
                          /^(\d+)-(\d+)\s+\(([\d.]+)%\)$/
                        );
                        if (!match) return entry.statDisplay;
                        return (
                          <RecordWithPercentage
                            wins={Number.parseInt(match[1]!, 10)}
                            losses={Number.parseInt(match[2]!, 10)}
                          />
                        );
                      })()
                    ) : (
                      entry.statDisplay
                    )}
                  </td>
                  {!isClubFundsMode && (
                    <td className="hidden px-4 py-3 text-sm text-gray-500 sm:table-cell">
                      {new Date(entry.achievedAt).toLocaleDateString()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-gray-600">
        {usingFallback
          ? "Showing local fallback · online sync unavailable"
          : "Updated online across all players"}
        {" · "}
        {modeLabel}
        {difficulty === "HARD" && leaderboardMode !== "challenge-cup"
          ? " · Hard"
          : ""}
        {" · "}
        {trackerLabel}
      </p>
    </div>
  );
}
