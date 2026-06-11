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
import { playUiClick } from "@/lib/sound";
import { HardModeBadge } from "./HardModeBadge";
import {
  BTN,
  CARD,
  SPACING,
  tabGroupButtonClass,
  tabGroupClass,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const PERIODS: LeaderboardPeriod[] = ["WEEKLY", "MONTHLY", "ALL_TIME"];

const STAT_COLUMN: Partial<Record<LeaderboardTrackerType, string>> = {
  squad_value: "Squad Value",
  most_wins: "Wins",
  perfect_runs: "27-0 Seasons",
  win_percentage: "Total Win %",
  best_record: "Record",
  challenge_cup_wins: "Cups Won",
  cup_match_wins: "Cup Wins",
  cup_finals: "Finals",
  cup_win_percentage: "Total Win %",
  challenge_cup_team_wins: "Tournament Wins",
};

interface LeaderboardTableProps {
  initialDifficulty?: GameDifficulty;
}

export function LeaderboardTable({
  initialDifficulty = "NORMAL",
}: LeaderboardTableProps) {
  const [leaderboardMode, setLeaderboardMode] =
    useState<LeaderboardDbMode>("super-league");
  const [tracker, setTracker] = useState<LeaderboardTrackerType>("squad_value");
  const [period, setPeriod] = useState<LeaderboardPeriod>("ALL_TIME");
  const [difficulty, setDifficulty] =
    useState<GameDifficulty>(initialDifficulty);
  const [entries, setEntries] = useState<LeaderboardTrackerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const requestId = useRef(0);

  const availableTrackers = getTrackersForDbMode(leaderboardMode);
  const activeTracker = isTrackerValidForDbMode(tracker, leaderboardMode)
    ? tracker
    : getDefaultTrackerForDbMode(leaderboardMode);

  const handleModeChange = (mode: LeaderboardDbMode) => {
    if (mode !== leaderboardMode) playUiClick();
    setLeaderboardMode(mode);
    setTracker(getDefaultTrackerForDbMode(mode));
    if (mode === "challenge-cup") {
      setDifficulty("NORMAL");
    }
  };

  const loadEntries = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);

    try {
      const result = await getTrackerLeaderboardAsync(
        activeTracker,
        period,
        difficulty,
        50,
        leaderboardMode
      );

      if (currentRequest !== requestId.current) return;

      setEntries(result.rows);
      setUsingFallback(result.source === "local");
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, [period, difficulty, leaderboardMode, activeTracker]);

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
        : "Normal Mode";

  const trackerLabel =
    availableTrackers.find((t) => t.id === activeTracker)?.label ??
    "Leaderboard";

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {(
          [
            { id: "super-league" as const, label: "Normal Mode" },
            { id: "draft" as const, label: "Draft Mode" },
            { id: "challenge-cup" as const, label: "Challenge Cup" },
          ] as const
        ).map((mode) => {
          const selected = leaderboardMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleModeChange(mode.id)}
              className={`min-h-[44px] rounded-xl border-2 px-4 py-4 text-left transition ${
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

      <div className="mb-5 border-b border-pitch-700/60">
        <div className="-mb-px flex gap-1 overflow-x-auto pb-px">
          {availableTrackers.map((t) => {
            const selected = activeTracker === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (activeTracker !== t.id) playUiClick();
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
      </div>

      {leaderboardMode !== "challenge-cup" && (
        <div
          className={`mb-5 inline-flex flex-wrap ${tabGroupClass(
            difficulty === "HARD",
            difficulty === "NORMAL"
          )}`}
        >
          <button
            type="button"
            onClick={() => {
              if (difficulty !== "NORMAL") playUiClick();
              setDifficulty("NORMAL");
            }}
            className={tabGroupButtonClass(difficulty === "NORMAL")}
          >
            {leaderboardMode === "draft" ? "Standard Draft" : "Normal"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (difficulty !== "HARD") playUiClick();
              setDifficulty("HARD");
            }}
            className={tabGroupButtonClass(difficulty === "HARD", "hard")}
          >
            {leaderboardMode === "draft" ? "Hard Draft" : "Hard"}
          </button>
        </div>
      )}

      {difficulty === "HARD" && leaderboardMode !== "challenge-cup" && (
        <div className="mb-4">
          <HardModeBadge />
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              if (period !== p) playUiClick();
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

      {loading && entries.length === 0 ? (
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
                <th className="px-4 py-3">
                  {activeTracker === "challenge_cup_team_wins"
                    ? "Team"
                    : "Coach"}
                </th>
                <th className="px-4 py-3">
                  {STAT_COLUMN[activeTracker] ?? "Stat"}
                </th>
                <th className="hidden px-4 py-3 sm:table-cell">Updated</th>
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
                    {entry.statDisplay}
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-gray-500 sm:table-cell">
                    {new Date(entry.achievedAt).toLocaleDateString()}
                  </td>
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
