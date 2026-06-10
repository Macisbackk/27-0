"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  playCupFinalLoss,
  playCupFinalWin,
  playMatchBigWin,
  playMatchDefeat,
  playMatchNarrowWin,
  playMatchUpsetVictory,
  playSeasonStart,
} from "@/lib/sound";
import type { ChallengeCupResult } from "@/lib/game/challenge-cup-simulation";
import {
  formatCupFixtureScore,
  getCupRoundLabel,
} from "@/lib/game/challenge-cup-simulation";

interface ChallengeCupSimulationProps {
  result: ChallengeCupResult;
  onComplete: () => void;
}

export function ChallengeCupSimulation({
  result,
  onComplete,
}: ChallengeCupSimulationProps) {
  const [gameIndex, setGameIndex] = useState(0);
  const [phase, setPhase] = useState<"simulating" | "complete">("simulating");
  const startSoundPlayed = useRef(false);
  const completeSoundPlayed = useRef(false);

  const totalRounds = result.fixtures.length;
  const currentFixture =
    gameIndex > 0 ? result.fixtures[gameIndex - 1] : null;

  useEffect(() => {
    if (!startSoundPlayed.current) {
      startSoundPlayed.current = true;
      playSeasonStart();
    }
  }, []);

  useEffect(() => {
    if (gameIndex >= totalRounds) {
      setPhase("complete");
      if (!completeSoundPlayed.current) {
        completeSoundPlayed.current = true;
        if (result.isWinner) playCupFinalWin();
        else if (result.finish === "Runners-Up") playCupFinalLoss();
        else playMatchDefeat();
      }
      const timer = setTimeout(onComplete, 2800);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      const fixture = result.fixtures[gameIndex];
      if (fixture.result === "W") {
        const margin = fixture.pointsFor - fixture.pointsAgainst;
        if (fixture.isUpset) playMatchUpsetVictory();
        else if (fixture.isThrashing || margin >= 16) playMatchBigWin();
        else playMatchNarrowWin();
      } else {
        playMatchDefeat();
      }
      setGameIndex((i) => i + 1);
    }, 220);

    return () => clearTimeout(timer);
  }, [gameIndex, totalRounds, result.fixtures, onComplete]);

  const currentRoundLabel =
    gameIndex < totalRounds
      ? getCupRoundLabel(gameIndex + 1)
      : getCupRoundLabel(totalRounds);

  return (
    <div className="flex w-full flex-col items-center justify-center px-4 py-6">
      <motion.p
        className="font-display text-xs font-bold uppercase tracking-[0.35em] text-accent-green"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Challenge Cup
      </motion.p>

      <motion.h2
        className="mt-2 font-display text-2xl font-black sm:text-3xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Knockout Tournament
      </motion.h2>

      <div className="mt-6 w-full max-w-lg">
        <div className="matchday-panel p-5 text-center sm:p-6">
          <p className="text-sm text-gray-500">{currentRoundLabel}</p>

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
                  {getCupRoundLabel(currentFixture.round)}
                </p>
                <p className="mt-1 font-display text-sm font-bold text-white sm:text-base">
                  {formatCupFixtureScore(currentFixture)}
                </p>
                <p
                  className={`mt-1 text-xs font-bold uppercase tracking-wider ${
                    currentFixture.result === "W"
                      ? "text-accent-green"
                      : "text-red-400"
                  }`}
                >
                  {currentFixture.result === "W" ? "Through" : "Eliminated"}
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
              <p className="font-display text-2xl font-black text-accent-gold">
                {result.resultLabel}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                {result.matchesPlayed} match
                {result.matchesPlayed !== 1 ? "es" : ""} played
              </p>
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
                  {getCupRoundLabel(f.round)}: {formatCupFixtureScore(f)}
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
