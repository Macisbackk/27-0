"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { LiveMatchCommand, ManagerCareer } from "@/lib/manager/types";
import {
  advanceLiveTick,
  advanceLiveToFullTime,
  createLiveMatch,
  formatLiveClock,
  getLiveCommandLabel,
  getLiveMatchEvents,
  getMatchStatusLabel,
  liveMatchToFixture,
  REAL_TICK_MS,
  type LiveMatchState,
} from "@/lib/manager/managerLiveMatch";
import {
  applyManagerMatchResult,
  getNextManagerFixture,
} from "@/lib/manager/managerSimulation";
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
  const sched = getNextManagerFixture(career);
  const fixtureKey = sched?.id ?? "none";
  const [live, setLive] = useState<LiveMatchState | null>(null);
  const [command, setCommand] = useState<LiveMatchCommand>("balanced");
  const [isPaused, setIsPaused] = useState(false);
  const finishedRef = useRef(false);
  const careerRef = useRef(career);
  const commandRef = useRef(command);
  const liveRef = useRef(live);

  careerRef.current = career;
  commandRef.current = command;
  liveRef.current = live;

  useEffect(() => {
    if (!sched) return;
    setLive(createLiveMatch(careerRef.current, sched));
    setCommand("balanced");
    setIsPaused(false);
    finishedRef.current = false;
  }, [fixtureKey]);

  const finishMatch = useCallback(
    (finalState: LiveMatchState) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const fixture = liveMatchToFixture(finalState, careerRef.current);
      const next = applyManagerMatchResult(careerRef.current, fixture, {
        playedLive: true,
        schedOverride: sched ?? undefined,
        liveEvents: getLiveMatchEvents(finalState),
      });
      onComplete(next);
    },
    [sched, onComplete]
  );

  useEffect(() => {
    if (!sched || isPaused) return;

    const timer = window.setInterval(() => {
      setLive((prev) => {
        if (!prev || prev.isComplete) return prev;
        return advanceLiveTick(
          prev,
          careerRef.current,
          commandRef.current
        );
      });
    }, REAL_TICK_MS);

    return () => window.clearInterval(timer);
  }, [fixtureKey, isPaused, sched]);

  useEffect(() => {
    if (live?.isComplete && !finishedRef.current) {
      const timeout = window.setTimeout(() => {
        if (liveRef.current) finishMatch(liveRef.current);
      }, 1200);
      return () => window.clearTimeout(timeout);
    }
  }, [live?.isComplete, finishMatch]);

  const handleSimulateToFullTime = () => {
    if (!live || live.isComplete) return;
    playSimulateRound();
    setLive(advanceLiveToFullTime(live, careerRef.current, commandRef.current));
  };

  if (!sched || !live) return null;

  const userName = career.club;
  const oppName = sched.opponent;
  const homeName = live.isHome ? userName : oppName;
  const awayName = live.isHome ? oppName : userName;
  const homeScore = live.isHome ? live.userScore : live.oppScore;
  const awayScore = live.isHome ? live.oppScore : live.userScore;
  const status = getMatchStatusLabel(live.userScore, live.oppScore, live.isHome);

  return (
    <div className={SPACING.stackLg}>
      <div className={`${CARD.elevated} ${SPACING.cardPadding} text-center`}>
        <p className={TYPO.sectionLabel}>
          {sched.label ?? `Round ${sched.round}`} ·{" "}
          {sched.isHome ? "Home" : "Away"}
        </p>
        <p className={`mt-2 text-2xl font-bold text-white sm:text-3xl`}>
          {homeName}{" "}
          <span className="text-theme-primary">{homeScore}</span>
          <span className="mx-2 text-pitch-500">-</span>
          <span className="text-theme-primary">{awayScore}</span>{" "}
          {awayName}
        </p>
        <p className={`mt-1 font-mono text-xl text-accent-gold`}>
          {formatLiveClock(live.minute)}
          {live.isComplete ? " · Full Time" : isPaused ? " · Paused" : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${STATUS_PILL_CLASS[status.tone]}`}
          >
            {status.pill}
          </span>
          <span className={`${TYPO.bodySm} text-pitch-300`}>{status.line}</span>
        </div>
        <p className={`mt-1 text-xs text-pitch-500`}>
          Momentum: {live.momentum > 0 ? "+" : ""}
          {live.momentum}
        </p>
      </div>

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={TYPO.sectionLabel}>Current Command</p>
        <p className="mt-1 font-medium text-white">
          {getLiveCommandLabel(command)}
        </p>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          {live.effectivenessLine}
        </p>
      </div>

      {!live.isComplete && (
        <>
          <div className={`${CARD.base} ${SPACING.cardPadding}`}>
            <p className={`${TYPO.sectionLabel} mb-2`}>Match Commands</p>
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
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <GameButton
              variant="secondary"
              onClick={() => {
                playUiClick();
                setIsPaused((p) => !p);
              }}
            >
              {isPaused ? "Resume" : "Pause"}
            </GameButton>
            <GameButton variant="theme" onClick={handleSimulateToFullTime}>
              Simulate to Full Time
            </GameButton>
            <GameButton
              variant="secondary"
              onClick={() => {
                playUiClick();
                onCancel();
              }}
            >
              Leave Match
            </GameButton>
          </div>
        </>
      )}

      <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
        <p className={TYPO.sectionLabel}>Recent Events</p>
        {live.events.length === 0 ? (
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
            Waiting for the opening exchanges…
          </p>
        ) : (
          <ul className={`mt-2 max-h-48 overflow-y-auto ${SPACING.stackSm}`}>
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
        <GameButton
          variant="theme"
          onClick={() => finishMatch(live)}
        >
          View Match Review
        </GameButton>
      )}
    </div>
  );
}
