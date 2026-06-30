"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { LiveMatchCommand, ManagerCareer } from "@/lib/manager/types";
import {
  advanceLiveMinute,
  advanceLiveToFullTime,
  createLiveMatch,
  formatLiveClock,
  getLiveCommandLabel,
  getLiveMatchEvents,
  liveMatchToFixture,
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
  "kick_early",
  "use_forwards",
  "spread_wide",
  "calm_down",
];

const TICK_MS = 900;

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
  const [live, setLive] = useState<LiveMatchState | null>(null);
  const [command, setCommand] = useState<LiveMatchCommand>("balanced");
  const [isPaused, setIsPaused] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (sched) {
      setLive(createLiveMatch(career, sched));
      finishedRef.current = false;
    }
  }, [career, sched]);

  const finishMatch = useCallback(
    (finalState: LiveMatchState) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const fixture = liveMatchToFixture(finalState, career);
      const next = applyManagerMatchResult(career, fixture, {
        playedLive: true,
        schedOverride: sched ?? undefined,
        liveEvents: getLiveMatchEvents(finalState),
      });
      onComplete(next);
    },
    [career, sched, onComplete]
  );

  useEffect(() => {
    if (!live || live.isComplete || isPaused) return;

    const timer = window.setInterval(() => {
      setLive((prev) => {
        if (!prev || prev.isComplete) return prev;
        const next = advanceLiveMinute(prev, career, command);
        return next;
      });
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [live, live?.isComplete, isPaused, command, career]);

  useEffect(() => {
    if (live?.isComplete && !finishedRef.current) {
      const timeout = window.setTimeout(() => finishMatch(live), 1200);
      return () => window.clearTimeout(timeout);
    }
  }, [live, finishMatch]);

  const handleSimulateToFullTime = () => {
    if (!live || live.isComplete) return;
    playSimulateRound();
    const next = advanceLiveToFullTime(live, career, command);
    setLive(next);
  };

  if (!sched || !live) return null;

  const userName = career.club;
  const oppName = sched.opponent;
  const homeName = live.isHome ? userName : oppName;
  const awayName = live.isHome ? oppName : userName;
  const homeScore = live.isHome ? live.userScore : live.oppScore;
  const awayScore = live.isHome ? live.oppScore : live.userScore;

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
            <GameButton
              variant="theme"
              onClick={handleSimulateToFullTime}
            >
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
