"use client";

import { useEffect, useRef, useState } from "react";
import {
  playMatchBigWin,
  playMatchDefeat,
  playMatchNarrowWin,
  playMatchUpsetVictory,
  playPerfectSeason,
  playSeasonComplete,
  playWinlessSeason,
} from "@/lib/sound";
import { motion, AnimatePresence } from "framer-motion";
import type { SeasonResult } from "@/lib/game/season-simulation";
import {
  DREAM_TEAM_NAME,
  SEASON_GAMES,
  formatFixtureScore,
} from "@/lib/game/season-simulation";

interface SeasonSimulationProps {
  result: SeasonResult;
  onComplete: () => void;
}

export function SeasonSimulation({ result, onComplete }: SeasonSimulationProps) {
  const [gameIndex, setGameIndex] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [phase, setPhase] = useState<"simulating" | "complete">("simulating");
  const seasonCompleteSoundPlayed = useRef(false);

  const currentFixture =
    gameIndex > 0 ? result.fixtures[gameIndex - 1] : null;

  useEffect(() => {
    if (gameIndex >= SEASON_GAMES) {
      setPhase("complete");
      if (!seasonCompleteSoundPlayed.current) {
        seasonCompleteSoundPlayed.current = true;
        if (result.isPerfect) playPerfectSeason();
        else if (result.wins === 0) playWinlessSeason();
        else playSeasonComplete();
      }
      const timer = setTimeout(onComplete, 2800);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      const fixture = result.fixtures[gameIndex];
      if (fixture.result === "W") {
        setWins((w) => w + 1);
        const margin = fixture.pointsFor - fixture.pointsAgainst;
        if (fixture.isUpset) {
          playMatchUpsetVictory();
        } else if (fixture.isThrashing || margin >= 20) {
          playMatchBigWin();
        } else {
          playMatchNarrowWin();
        }
      } else {
        setLosses((l) => l + 1);
        playMatchDefeat();
      }
      setGameIndex((i) => i + 1);
    }, 180);

    return () => clearTimeout(timer);
  }, [gameIndex, result.fixtures, onComplete]);

  const currentRound = Math.min(gameIndex + 1, SEASON_GAMES);

  return (
    <div className="flex w-full flex-col items-center justify-center px-4 py-6">
      <motion.p
        className="font-display text-xs font-bold uppercase tracking-[0.35em] text-accent-green"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Season Simulation
      </motion.p>

      <motion.h2
        className="mt-2 font-display text-2xl font-black sm:text-3xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Super League Campaign
      </motion.h2>

      <div className="mt-6 w-full max-w-lg">
        <div className="matchday-panel p-5 text-center sm:p-6">
          <p className="text-sm text-gray-500">
            Round {currentRound} of {SEASON_GAMES}
          </p>

          <div className="mt-4 flex items-center justify-center gap-8">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Wins
              </p>
              <motion.p
                key={wins}
                className="font-display text-3xl font-black text-accent-green sm:text-4xl"
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
              >
                {wins}
              </motion.p>
            </div>
            <div className="text-xl text-gray-600">—</div>
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Losses
              </p>
              <motion.p
                key={losses}
                className="font-display text-3xl font-black text-red-400 sm:text-4xl"
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
              >
                {losses}
              </motion.p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {currentFixture && phase === "simulating" && (
              <motion.div
                key={gameIndex}
                className="mt-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <p className="text-xs text-gray-500">
                  Round {currentFixture.round}
                </p>
                <p className="mt-1 font-display text-sm font-bold text-white sm:text-base">
                  {formatFixtureScore(currentFixture)}
                </p>
                <p
                  className={`mt-1 text-xs font-bold uppercase tracking-wider ${
                    currentFixture.result === "W"
                      ? "text-accent-green"
                      : "text-red-400"
                  }`}
                >
                  {currentFixture.result === "W" ? "Win" : "Loss"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === "complete" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6"
            >
              <p className="font-display text-2xl font-black">
                Final Record: {result.wins}-{result.losses}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                League Position: #{result.leaguePosition}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Points Difference:{" "}
                {result.pointsDifference > 0 ? "+" : ""}
                {result.pointsDifference}
              </p>
              {result.insights.length > 0 && (
                <div className="mt-4 space-y-1.5 text-left">
                  {result.insights.slice(0, 3).map((insight) => (
                    <p
                      key={insight}
                      className="rounded-lg bg-pitch-900/50 px-3 py-2 text-xs text-gray-400"
                    >
                      {insight}
                    </p>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>

        <div className="mt-4 max-h-32 overflow-y-auto rounded-xl border border-pitch-700/50 bg-pitch-950/50 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Results
          </p>
          <div className="space-y-1">
            {result.fixtures.slice(0, gameIndex).map((f) => (
              <div
                key={f.round}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="truncate text-gray-400">
                  R{f.round}: {formatFixtureScore(f)}
                </span>
                <span
                  className={`shrink-0 font-bold ${
                    f.result === "W" ? "text-accent-green" : "text-red-400"
                  }`}
                >
                  {f.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
