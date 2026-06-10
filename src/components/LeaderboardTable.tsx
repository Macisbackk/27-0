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
import { HardModeBadge } from "./HardModeBadge";

const PERIODS: LeaderboardPeriod[] = ["WEEKLY", "MONTHLY", "ALL_TIME"];

const STAT_COLUMN: Partial<Record<LeaderboardTrackerType, string>> = {
  squad_value: "Squad Value",
  most_wins: "Wins",
  perfect_runs: "27-0 Seasons",
  win_percentage: "Win %",
  best_record: "Record",
  challenge_cup_wins: "Cups Won",
  cup_match_wins: "Cup Wins",
  cup_finals: "Finals",
  cup_best_run: "Best Run",
  cup_win_percentage: "Cup Win %",
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
              className={`rounded-xl border-2 px-4 py-4 text-left transition ${
                selected
                  ? "border-accent-green/60 bg-accent-green/10 shadow-[0_0_24px_rgba(34,197,94,0.12)]"
                  : "border-pitch-600/50 bg-pitch-900/50 hover:border-pitch-500/60 hover:bg-pitch-800/40"
              }`}
            >
              <span
                className={`font-display text-sm font-bold uppercase tracking-wider sm:text-base ${
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
                onClick={() => setTracker(t.id)}
                className={`shrink-0 border-b-2 px-3 py-2 font-display text-[11px] font-bold uppercase tracking-wider transition sm:px-4 sm:text-xs ${
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
        <div className="mb-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setDifficulty("NORMAL")}
            className={`rounded-xl border-2 px-5 py-3 font-display text-xs font-bold uppercase tracking-wider transition sm:text-sm ${
              difficulty === "NORMAL"
                ? "border-accent-green/60 bg-accent-green/10 text-accent-green"
                : "border-pitch-600/50 bg-pitch-900/50 text-gray-400 hover:text-white"
            }`}
          >
            {leaderboardMode === "draft" ? "Standard Draft" : "Normal"}
          </button>
          <button
            type="button"
            onClick={() => setDifficulty("HARD")}
            className={`rounded-xl border-2 px-5 py-3 font-display text-xs font-bold uppercase tracking-wider transition sm:text-sm ${
              difficulty === "HARD"
                ? "border-red-500/60 bg-red-600/15 text-red-300 shadow-[0_0_20px_rgba(220,38,38,0.15)]"
                : "border-pitch-600/50 bg-pitch-900/50 text-gray-400 hover:text-white"
            }`}
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
            onClick={() => setPeriod(p)}
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
                <th className="px-4 py-3">Coach</th>
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
