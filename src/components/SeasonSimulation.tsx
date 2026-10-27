"use client";

import { useEffect, useRef, useState } from "react";
import {
  playMatchBigWin,
  playMatchDefeat,
  playMatchNarrowWin,
  playMatchStarted,
  playMatchUpsetVictory,
  playPerfectSeason,
  playSeasonComplete,
  playUiClick,
  playWinlessSeason,
} from "@/lib/sound";
import { motion } from "framer-motion";
import type { SeasonResult } from "@/lib/game/season-simulation";
import {
  DREAM_TEAM_NAME,
  SEASON_GAMES,
  formatFixtureScore,
} from "@/lib/game/season-simulation";
import { TYPO } from "@/lib/ui/typography";
import {
  HALFWAY_CALL_OPTIONS,
  HALFWAY_CALL_ROUND,
  getHalfwayCallLabel,
  type HalfwayCallChoice,
  type HalfwayCallId,
} from "@/lib/game/halfway-call";

interface SeasonSimulationProps {
  result: SeasonResult;
  onComplete: () => void;
  /**
   * Mid-season fork. When provided, the sim pauses after round 14 until the player
   * picks a plan (or skips to full time, which keeps "no change"). The parent
   * re-simulates rounds 15–27 with the choice and passes the new `result`.
   */
  halfwayCall?: HalfwayCallChoice | null;
  onHalfwayCall?: (choice: HalfwayCallId) => void;
}

export function SeasonSimulation({
  result,
  onComplete,
  halfwayCall = null,
  onHalfwayCall,
}: SeasonSimulationProps) {
  const [gameIndex, setGameIndex] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [phase, setPhase] = useState<"simulating" | "complete">("simulating");
  const [forkDismissed, setForkDismissed] = useState(false);
  const seasonCompleteSoundPlayed = useRef(false);
  const matchStartedSoundPlayed = useRef(false);

  const currentFixture =
    gameIndex > 0 ? result.fixtures[gameIndex - 1] : null;

  // Pause at the fork: 14 rounds played and still perfect (the call is about chasing 27-0, so
  // it only shows while 27-0 is alive), no plan picked yet, and the parent can take one.
  const unbeatenAtHalfway = result.fixtures
    .slice(0, HALFWAY_CALL_ROUND)
    .every((f) => f.result === "W");
  const forkOpen =
    !!onHalfwayCall &&
    unbeatenAtHalfway &&
    !forkDismissed &&
    halfwayCall === null &&
    phase === "simulating" &&
    gameIndex === HALFWAY_CALL_ROUND;

  useEffect(() => {
    if (matchStartedSoundPlayed.current) return;
    matchStartedSoundPlayed.current = true;
    playMatchStarted();
  }, []);

  useEffect(() => {
    if (forkOpen) return;
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
  }, [gameIndex, result.fixtures, onComplete, forkOpen]);

  const currentRound = forkOpen ? HALFWAY_CALL_ROUND : Math.min(gameIndex + 1, SEASON_GAMES);
  const skipToEnd = () => {
    if (phase !== "simulating") return;
    // Skipping past the fork without choosing keeps the season as simulated (no change).
    setForkDismissed(true);
    setWins(result.fixtures.filter((f) => f.result === "W").length);
    setLosses(result.fixtures.filter((f) => f.result !== "W").length);
    setGameIndex(SEASON_GAMES);
  };
  const chooseHalfwayCall = (choice: HalfwayCallId) => {
    if (!forkOpen || !onHalfwayCall) return;
    playUiClick();
    onHalfwayCall(choice);
  };
  const halfwayCallLabel =
    halfwayCall && halfwayCall !== "none" ? getHalfwayCallLabel(halfwayCall) : null;

  // The sim sits under the pitch: bring it into view when it starts so the first result isn't missed.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const t = window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div ref={rootRef} className="flex w-full min-w-0 scroll-mt-20 flex-col items-center justify-center py-1 sm:py-2">
      <motion.p
        className={`${TYPO.eyebrow} text-[color:var(--fl-muted)]`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Season Simulation
      </motion.p>

      <motion.h2
        className="mt-1 text-center text-[22px] font-bold leading-tight tracking-tight text-white sm:text-[26px]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {phase === "complete" ? "Full time on the season" : "Your season"}
      </motion.h2>

      <div className="mt-4 w-full min-w-0 max-w-lg">
        <div className="rounded-tile bg-pitch-800 p-4 text-center sm:p-5">
          <p className={TYPO.label}>
            Round {currentRound} of {SEASON_GAMES}
          </p>
          <div
            className="mx-auto mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-pitch-950"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={SEASON_GAMES}
            aria-valuenow={Math.min(gameIndex, SEASON_GAMES)}
            aria-label="Season progress"
          >
            <div
              className="h-full rounded-full bg-theme-primary transition-[width] duration-150"
              style={{ width: `${(Math.min(gameIndex, SEASON_GAMES) / SEASON_GAMES) * 100}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-center gap-5 sm:gap-8">
            <div>
              <p className={TYPO.label}>
                Wins
              </p>
              <motion.p
                key={wins}
                className="fl-number mt-1 text-[40px] text-theme-primary sm:text-[48px]"
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
              >
                {wins}
              </motion.p>
            </div>
            <div className="text-xl text-white/20">—</div>
            <div>
              <p className={TYPO.label}>
                Losses
              </p>
              <motion.p
                key={losses}
                className="fl-number mt-1 text-[40px] text-red-400 sm:text-[48px]"
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
              >
                {losses}
              </motion.p>
            </div>
          </div>

          {forkOpen ? (
            <motion.div
              className="mt-4 rounded-tile bg-pitch-950 p-3 text-left sm:p-4"
              role="group"
              aria-label="Unbeaten at halfway. How do you chase 27-0?"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className={`${TYPO.eyebrow} text-theme-primary`}>Round {HALFWAY_CALL_ROUND} · {wins}-{losses}</p>
              <p className="mt-1 text-[17px] font-bold leading-tight text-white">
                Unbeaten at halfway. How do you chase 27-0?
              </p>
              <p className="mt-1 text-xs text-[color:var(--fl-muted)]">
                One call for the rest of the season. No changes after.
===
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {HALFWAY_CALL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => chooseHalfwayCall(option.id)}
                    className="btn-press flex min-h-[44px] w-full flex-col items-start rounded-control bg-pitch-800 px-3 py-2 text-left transition hover:bg-pitch-700"
                  >
                    <span className="text-sm font-bold text-white">{option.label}</span>
                    <span className="mt-0.5 text-xs text-[color:var(--fl-muted)]">
                      {option.detail}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : null}

          {/* One live result line (no exit animations: those stacked up as invisible blocks
              and made the card keep growing). Fixed height so nothing below jumps. */}
          {phase === "simulating" && !forkOpen ? (
            <div className="mt-4 min-h-[4.25rem]" aria-live="polite">
              {currentFixture ? (
                <div key={gameIndex} className="fl-rise">
                  <p className="text-xs text-[color:var(--fl-muted)]">
                    Round {currentFixture.round}
                  </p>
                  <p className="mt-1 text-sm font-bold text-white sm:text-base">
                    {formatFixtureScore(currentFixture)}
                  </p>
                  <p
                    className={`mt-1 text-xs font-bold ${
                      currentFixture.result === "W"
                        ? "text-theme-primary"
                        : currentFixture.result === "D"
                          ? "text-gray-300"
                          : "text-red-400"
                    }`}
                  >
                    {currentFixture.result === "W"
                      ? "Win"
                      : currentFixture.result === "D"
                        ? "Draw"
                        : "Loss"}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === "complete" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-5"
            >
              <p className={TYPO.label}>Final Record</p>
              <p className="fl-number mt-1 text-[34px] text-white">
                {result.wins}-{result.losses}
              </p>
              <p className="mt-2 text-sm text-[color:var(--fl-text)]">
                League Position: #{result.leaguePosition}
              </p>
              <p className="mt-1 text-sm text-[color:var(--fl-muted)]">
                Points Difference:{" "}
                {result.pointsDifference > 0 ? "+" : ""}
                {result.pointsDifference}
              </p>
              {halfwayCallLabel ? (
                <p className="mt-1 text-sm text-[color:var(--fl-muted)]">
                  Halfway call: <span className="text-white">{halfwayCallLabel}</span>
                </p>
              ) : null}
              {result.insights.length > 0 && (
                <div className="mt-4 space-y-1.5 text-left">
                  {result.insights.slice(0, 3).map((insight) => (
                    <p
                      key={insight}
                      className="rounded-control bg-pitch-950 px-3 py-2 text-xs text-[color:var(--fl-muted)]"
                    >
                      {insight}
                    </p>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {phase === "simulating" ? (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={skipToEnd}
              className="btn-press inline-flex min-h-[44px] items-center justify-center rounded-full bg-pitch-800 px-5 text-sm font-semibold text-[color:var(--fl-text)] transition hover:bg-pitch-700"
            >
              {forkOpen ? "Skip to full time (no change)" : "Skip to full time"}
            </button>
          </div>
        ) : null}

        {/* Form guide: one tile per round, filled in as results land. */}
        <div className="mt-3 grid grid-cols-9 gap-1" aria-label="Results by round">
          {result.fixtures.map((f, i) => {
            const played = i < gameIndex;
            return (
              <span
                key={f.round}
                title={played ? `R${f.round}: ${formatFixtureScore(f)}` : `Round ${f.round}`}
                className={`flex aspect-square items-center justify-center rounded-full text-[10px] font-bold ${
                  !played
                    ? "bg-pitch-950 text-[color:var(--fl-muted)]"
                    : f.result === "W"
                      ? "bg-theme-primary text-[color:var(--theme-text-on-primary)]"
                      : f.result === "D"
                        ? "bg-gray-500 text-black"
                        : "bg-red-500/85 text-white"
                }`}
              >
                {played ? f.result : f.round}
              </span>
            );
          })}
        </div>

        <details className="mt-3 rounded-tile bg-pitch-800 px-3 sm:px-4">
          <summary className={`flex min-h-[44px] cursor-pointer select-none items-center ${TYPO.label}`}>
            Results ({Math.min(gameIndex, SEASON_GAMES)})
          </summary>
          <div className="space-y-0.5 pb-3">
            {result.fixtures.slice(0, gameIndex).map((f) => (
              <div
                key={f.round}
                className="flex items-center justify-between gap-2 text-[11px] sm:text-xs"
              >
                <span className="truncate text-[color:var(--fl-muted)]">
                  R{f.round}: {formatFixtureScore(f)}
                </span>
                <span
                  className={`shrink-0 font-bold ${
                    f.result === "W"
                      ? "text-theme-primary"
                      : f.result === "D"
                        ? "text-gray-300"
                        : "text-red-400"
                  }`}
                >
                  {f.result}
                </span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
