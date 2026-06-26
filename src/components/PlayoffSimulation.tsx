"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  playCupFinalLoss,
  playCupFinalWin,
  playMatchBigWin,
  playMatchDefeat,
  playMatchNarrowWin,
  playMatchUpsetVictory,
  playSeasonStart,
} from "@/lib/sound";
import type { PlayoffResult } from "@/lib/game/playoff-simulation";
import { formatFixtureScore } from "@/lib/game/season-simulation";

interface PlayoffSimulationProps {
  result: PlayoffResult;
  onComplete: () => void;
}

export function PlayoffSimulation({
  result,
  onComplete,
}: PlayoffSimulationProps) {
  const userFixtures = result.userFixtures;
  const [gameIndex, setGameIndex] = useState(0);
  const [phase, setPhase] = useState<"simulating" | "complete">("simulating");
  const startSoundPlayed = useRef(false);
  const completeSoundPlayed = useRef(false);

  const currentFixture =
    gameIndex > 0 ? userFixtures[gameIndex - 1] : null;
  const currentRound =
    gameIndex < result.rounds.length
      ? result.rounds[gameIndex]
      : result.rounds[result.rounds.length - 1];

  useEffect(() => {
    if (!startSoundPlayed.current) {
      startSoundPlayed.current = true;
      playSeasonStart();
    }
  }, []);

  useEffect(() => {
    if (gameIndex >= userFixtures.length) {
      setPhase("complete");
      if (!completeSoundPlayed.current) {
        completeSoundPlayed.current = true;
        if (result.isChampion) playCupFinalWin();
        else if (result.finish === "Grand Final Runner-Up") playCupFinalLoss();
        else playMatchDefeat();
      }
      const timer = setTimeout(onComplete, 2800);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      const fixture = userFixtures[gameIndex];
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
  }, [gameIndex, userFixtures, onComplete, result]);

  return (
    <div className="flex w-full flex-col items-center justify-center px-4 py-6">
      <motion.p
        className="font-display text-xs font-bold uppercase tracking-[0.35em] text-accent-green"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Super League Play-Offs
      </motion.p>

      <motion.h2
        className="mt-2 font-display text-2xl font-black sm:text-3xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {currentRound?.round ?? "Knockout"}
      </motion.h2>

      <div className="mt-6 w-full max-w-lg">
        <div className="matchday-panel p-5 text-center sm:p-6">
          {currentFixture ? (
            <>
              <p className="text-sm text-gray-500">
                {currentFixture.isHome
                  ? "Home "
                  : currentRound?.isNeutral
                    ? ""
                    : "Away "}
                vs {currentFixture.opponent}
              </p>
              <p className="mt-3 font-display text-3xl font-black text-white">
                {formatFixtureScore(currentFixture)}
              </p>
              <p
                className={`mt-2 text-sm font-semibold ${
                  currentFixture.result === "W"
                    ? "text-accent-green"
                    : "text-red-400"
                }`}
              >
                {currentFixture.result === "W" ? "Progress" : "Eliminated"}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Preparing play-off draw…</p>
          )}
        </div>
      </div>

      {phase === "complete" && (
        <motion.p
          className="mt-6 text-center font-display text-lg font-bold text-accent-gold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {result.finish}
        </motion.p>
      )}
    </div>
  );
}
