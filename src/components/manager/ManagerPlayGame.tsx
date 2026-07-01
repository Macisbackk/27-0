"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { LiveMatchCommand, ManagerCareer } from "@/lib/manager/types";
import {
  advanceLiveTick,
  advanceLiveToFullTime,
  commandFromTactics,
  createLiveMatch,
  formatLiveClock,
  getLiveCommandLabel,
  getLiveMatchEvents,
  getMatchStatusLabel,
  HALFTIME_MINUTE,
  liveMatchToFixture,
  REAL_TICK_MS,
  type LiveMatchState,
} from "@/lib/manager/managerLiveMatch";
import {
  applyManagerMatchResult,
  getNextManagerFixture,
} from "@/lib/manager/managerSimulation";
import { ensureCupBracketReady } from "@/lib/manager/managerChallengeCup";
import { ensurePlayoffsReady } from "@/lib/manager/managerPlayoffs";
import { computeManagerTeamRating } from "@/lib/manager/managerRating";
import { getOpponentMatchRating } from "@/lib/game/opponent-scorers";
import { playSimulateRound, playUiClick } from "@/lib/sound";

const COMMANDS: LiveMatchCommand[] = [
  "balanced",
  "attack",
  "defend",
  "use_forwards",
  "spread_wide",
];

const STATUS_PILL_CLASS = {
  win: "bg-theme-primary/20 text-theme-primary border-theme-primary/40",
  loss: "bg-red-500/20 text-red-300 border-red-500/40",
  level: "bg-pitch-700/50 text-pitch-200 border-pitch-600",
};

interface ManagerPlayGameProps {
  career: ManagerCareer;
  onComplete: (career: ManagerCareer) => void;
  onCancel: () => void;
}

export function ManagerPlayGame({
  career,
  onComplete,
  onCancel,
}: ManagerPlayGameProps) {
  const readyCareer = ensurePlayoffsReady(ensureCupBracketReady(career));
  const sched = getNextManagerFixture(readyCareer);
  const fixtureKey = sched?.id ?? "none";
  const [live, setLive] = useState<LiveMatchState | null>(null);
  const [command, setCommand] = useState<LiveMatchCommand>("balanced");
  const [clockRunning, setClockRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const finishedRef = useRef(false);
  const careerRef = useRef(career);
  const commandRef = useRef(command);
  const liveRef = useRef(live);

  careerRef.current = career;
  commandRef.current = command;
  liveRef.current = live;

  useEffect(() => {
    if (!sched) return;
    const tacticCommand = commandFromTactics(readyCareer);
    setLive(createLiveMatch(readyCareer, sched));
    setCommand(tacticCommand);
    commandRef.current = tacticCommand;
    setClockRunning(false);
    setHasStarted(false);
    finishedRef.current = false;
  }, [fixtureKey]);

  const finishMatch = useCallback(
    (finalState: LiveMatchState) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const fixture = liveMatchToFixture(finalState, careerRef.current);
      const next = applyManagerMatchResult(
        ensureCupBracketReady(careerRef.current),
        fixture,
        {
          playedLive: true,
          schedOverride: sched ?? undefined,
          liveEvents: getLiveMatchEvents(finalState),
        }
      );
      onComplete(next);
    },
    [sched, onComplete]
  );

  useEffect(() => {
    if (!sched || !clockRunning || !live) return;
    if (live.phase !== "first_half" && live.phase !== "second_half") return;

    const maxMinute = live.phase === "first_half" ? HALFTIME_MINUTE : 80;

    const timer = window.setInterval(() => {
      setLive((prev) => {
        if (!prev || prev.isComplete) return prev;
        const next = advanceLiveTick(
          prev,
          careerRef.current,
          commandRef.current,
          maxMinute
        );
        if (next.phase === "halftime") {
          setClockRunning(false);
        }
        if (next.isComplete) {
          setClockRunning(false);
        }
        return next;
      });
    }, REAL_TICK_MS);

    return () => window.clearInterval(timer);
  }, [fixtureKey, clockRunning, live?.phase, sched]);

  const handleStartGame = () => {
    playUiClick();
    setHasStarted(true);
    setClockRunning(true);
    setLive((prev) =>
      prev
        ? {
            ...prev,
            phase: "first_half",
            isPlaying: true,
            effectivenessLine: "Kick-off — first half underway.",
          }
        : prev
    );
  };

  const handleStartSecondHalf = () => {
    playUiClick();
    setClockRunning(true);
    setLive((prev) =>
      prev
        ? {
            ...prev,
            phase: "second_half",
            isPlaying: true,
            effectivenessLine: "Second half — play resumes.",
          }
        : prev
    );
  };

  const handleAbandon = () => {
    if (
      hasStarted &&
      !window.confirm("Abandon this match? Progress will be lost.")
    ) {
      return;
    }
    onCancel();
  };

  const handleSimulateToFullTime = () => {
    if (!live || live.isComplete) return;
    playSimulateRound();
    setClockRunning(false);
    const tacticCommand = commandFromTactics(careerRef.current);
    commandRef.current = tacticCommand;
    setCommand(tacticCommand);
    setLive(
      advanceLiveToFullTime(live, careerRef.current, tacticCommand)
    );
    setHasStarted(true);
  };

  if (!sched || !live) return null;

  const userRating = computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions,
    career
  );
  const oppRating = Math.round(
    getOpponentMatchRating(sched.opponent, career.seed, sched.round, {
      currentSeasonOnly: true,
    })
  );

  const homeName = live.isHome ? career.club : sched.opponent;
  const awayName = live.isHome ? sched.opponent : career.club;
  const homeScore = live.isHome ? live.userScore : live.oppScore;
  const awayScore = live.isHome ? live.oppScore : live.userScore;
  const status = getMatchStatusLabel(live.userScore, live.oppScore, live.isHome);
  const isPreview = live.phase === "preview";
  const isHalftime = live.phase === "halftime";
  const canClose = !hasStarted || live.isComplete;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Live match"
      onClick={canClose ? handleAbandon : undefined}
    >
      <div
        className={`card-glass max-h-[92vh] w-full max-w-lg overflow-y-auto ${SPACING.cardPadding}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={SPACING.stackLg}>
          <div className="text-center">
            <p className={TYPO.sectionLabel}>
              {sched.label ?? `Round ${sched.round}`} ·{" "}
              {sched.isHome ? "Home" : "Away"}
            </p>
            <p className={`mt-2 text-2xl font-bold text-white`}>
              {homeName}{" "}
              <span className="text-theme-primary">{homeScore}</span>
              <span className="mx-2 text-pitch-500">-</span>
              <span className="text-theme-primary">{awayScore}</span>{" "}
              {awayName}
            </p>
            {!isPreview && (
              <>
                <p className={`mt-1 font-mono text-xl text-accent-gold`}>
                  {formatLiveClock(live.minute)}
                  {live.isComplete
                    ? " · Full Time"
                    : isHalftime
                      ? " · Half Time"
                      : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${STATUS_PILL_CLASS[status.tone]}`}
                  >
                    {status.pill}
                  </span>
                  <span className={`${TYPO.bodySm} text-pitch-300`}>
                    {status.line}
                  </span>
                </div>
              </>
            )}
          </div>

          {isPreview && (
            <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
              <p className={TYPO.sectionLabel}>Match Preview</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <span>{career.club}: {userRating}</span>
                <span>{sched.opponent}: {oppRating}</span>
              </div>
              <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
                Tactics: {career.tactics.playingStyle.replace("_", " ")} ·{" "}
                {career.tactics.attackFocus.replace("_", " ")} ·{" "}
                {career.tactics.defenceFocus.replace("_", " ")}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <GameButton variant="theme" onClick={handleStartGame}>
                  Start Game
                </GameButton>
                <GameButton variant="secondary" onClick={handleSimulateToFullTime}>
                  Simulate to Full Time
                </GameButton>
                <GameButton
                  variant="secondary"
                  className="sm:col-span-2"
                  onClick={handleAbandon}
                >
                  Close
                </GameButton>
              </div>
            </div>
          )}

          {isHalftime && (
            <div className={`${CARD.elevated} ${SPACING.cardPadding}`}>
              <p className={TYPO.sectionLabel}>Half Time</p>
              <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
                {live.effectivenessLine}
              </p>
              <p className={`${TYPO.sectionLabel} mt-3 mb-2`}>
                Command for second half
              </p>
              <div className="grid grid-cols-2 gap-2">
                {COMMANDS.map((cmd) => (
                  <GameButton
                    key={cmd}
                    variant={command === cmd ? "theme" : "secondary"}
                    size="sm"
                    onClick={() => {
                      playUiClick();
                      setCommand(cmd);
                    }}
                  >
                    {getLiveCommandLabel(cmd)}
                  </GameButton>
                ))}
              </div>
              <GameButton
                variant="theme"
                className="mt-4"
                onClick={handleStartSecondHalf}
              >
                Start Second Half
              </GameButton>
            </div>
          )}

          {!isPreview && !isHalftime && !live.isComplete && (
            <>
              <div className={`${CARD.base} ${SPACING.cardPadding}`}>
                <p className={TYPO.sectionLabel}>Current Command</p>
                <p className="mt-1 font-medium text-white">
                  {getLiveCommandLabel(command)}
                </p>
                <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
                  {live.effectivenessLine}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {COMMANDS.map((cmd) => (
                  <GameButton
                    key={cmd}
                    variant={command === cmd ? "theme" : "secondary"}
                    size="sm"
                    onClick={() => {
                      playUiClick();
                      setCommand(cmd);
                    }}
                  >
                    {getLiveCommandLabel(cmd)}
                  </GameButton>
                ))}
              </div>
              <GameButton variant="secondary" onClick={handleSimulateToFullTime}>
                Simulate to Full Time
              </GameButton>
            </>
          )}

          <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
            <p className={TYPO.sectionLabel}>Match Events</p>
            {live.events.length === 0 ? (
              <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
                {isPreview ? "Events will appear once the match starts." : "Waiting for action…"}
              </p>
            ) : (
              <ul className={`mt-2 max-h-40 overflow-y-auto ${SPACING.stackSm}`}>
                {[...live.events].reverse().map((ev, i) => (
                  <li
                    key={`${ev.minute}-${ev.type}-${i}`}
                    className={`${TYPO.bodySm} ${
                      ev.team === "user" ? "text-white" : "text-pitch-400"
                    }`}
                  >
                    {ev.description}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {live.isComplete && (
            <GameButton variant="theme" onClick={() => finishMatch(live)}>
              View Match Review
            </GameButton>
          )}

          {hasStarted && !live.isComplete && (
            <GameButton variant="secondary" onClick={handleAbandon}>
              Abandon Match
            </GameButton>
          )}
        </div>
      </div>
    </div>
  );
}
