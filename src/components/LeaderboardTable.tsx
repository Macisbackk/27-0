"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameDifficulty, LeaderboardPeriod, LeaderboardRow } from "@/lib/types";
import { formatValue } from "@/lib/players";
import { formatPeriodLabel } from "@/lib/leaderboard";
import { getLeaderboardAsync } from "@/lib/storage/leaderboard";
import { ChallengeCupLeaderboard } from "./ChallengeCupLeaderboard";
import { HardModeBadge } from "./HardModeBadge";

const PERIODS: LeaderboardPeriod[] = ["WEEKLY", "MONTHLY", "ALL_TIME"];

type LeaderboardMode = "super-league" | "challenge-cup";

interface LeaderboardTableProps {
  initialDifficulty?: GameDifficulty;
}

export function LeaderboardTable({
  initialDifficulty = "NORMAL",
}: LeaderboardTableProps) {
  const [leaderboardMode, setLeaderboardMode] =
    useState<LeaderboardMode>("super-league");
  const [period, setPeriod] = useState<LeaderboardPeriod>("ALL_TIME");
  const [difficulty, setDifficulty] =
    useState<GameDifficulty>(initialDifficulty);
  const [entries, setEntries] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  const loadEntries = useCallback(async () => {
    if (leaderboardMode !== "super-league") return;
    setLoading(true);
    try {
      const result = await getLeaderboardAsync(
        period,
        difficulty,
        50,
        "super-league"
      );
      setEntries(result.rows);
      setUsingFallback(result.source === "local");
    } finally {
      setLoading(false);
    }
  }, [period, difficulty, leaderboardMode]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setLeaderboardMode("super-league")}
          className={`rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider transition ${
            leaderboardMode === "super-league"
              ? "bg-accent-green text-pitch-950"
              : "bg-pitch-800 text-gray-400 hover:text-white"
          }`}
        >
          Super League
        </button>
        <button
          onClick={() => setLeaderboardMode("challenge-cup")}
          className={`rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider transition ${
            leaderboardMode === "challenge-cup"
              ? "bg-accent-green text-pitch-950"
              : "bg-pitch-800 text-gray-400 hover:text-white"
          }`}
        >
          Challenge Cup
        </button>
      </div>

      {leaderboardMode === "challenge-cup" ? (
        <ChallengeCupLeaderboard />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setDifficulty("NORMAL")}
              className={`rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider transition ${
                difficulty === "NORMAL"
                  ? "bg-accent-green text-pitch-950"
                  : "bg-pitch-800 text-gray-400 hover:text-white"
              }`}
            >
              Normal Mode
            </button>
            <button
              onClick={() => setDifficulty("HARD")}
              className={`rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider transition ${
                difficulty === "HARD"
                  ? "bg-red-600 text-white"
                  : "bg-pitch-800 text-gray-400 hover:text-white"
              }`}
            >
              Hard Mode
            </button>
          </div>

          {difficulty === "HARD" && (
            <div className="mb-4">
              <HardModeBadge />
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  period === p
                    ? "bg-pitch-700 text-white"
                    : "bg-pitch-800 text-gray-400 hover:text-white"
                }`}
              >
                {formatPeriodLabel(p)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="matchday-panel p-12 text-center text-gray-500">
              Loading leaderboard…
            </div>
          ) : entries.length === 0 ? (
            <div className="matchday-panel p-12 text-center text-gray-500">
              No {difficulty === "HARD" ? "hard mode" : "normal"} entries yet.
              Complete a run to appear on the leaderboard!
            </div>
          ) : (
            <div className="matchday-panel overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-pitch-600/50 text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Squad Value</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Date</th>
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
                        {formatValue(entry.squadValue)}
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
            {difficulty === "HARD" ? "Hard Mode" : "Normal Mode"}
          </p>
        </>
      )}
    </div>
  );
}
