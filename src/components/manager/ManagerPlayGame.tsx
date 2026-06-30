"use client";

import { useCallback, useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { LiveMatchCommand, ManagerCareer } from "@/lib/manager/types";
import {
  advanceLiveMatch,
  createLiveMatch,
  getLiveCommandLabel,
  liveMatchToFixture,
  type LiveMatchState,
} from "@/lib/manager/managerLiveMatch";
import { applyManagerMatchResult } from "@/lib/manager/managerSimulation";
import { playSimulateRound, playUiClick } from "@/lib/sound";

const COMMANDS: LiveMatchCommand[] = [
  "attack",
  "defend",
  "balanced",
  "kick_early",
  "use_forwards",
  "spread_wide",
  "calm_down",
];

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
  const sched = career.schedule[career.currentFixtureIndex];
  const [live, setLive] = useState<LiveMatchState | null>(null);

  useEffect(() => {
    if (sched) setLive(createLiveMatch(career, sched));
  }, [career, sched]);

  const advance = useCallback(
    (command: LiveMatchCommand) => {
      if (!live || live.isComplete) return;
      playSimulateRound();
      const next = advanceLiveMatch(live, career, command);
      setLive(next);
    },
    [live, career]
  );

  const finishMatch = useCallback(() => {
    if (!live) return;
    const fixture = liveMatchToFixture(live, career);
    const next = applyManagerMatchResult(career, fixture, { playedLive: true });
    onComplete(next);
  }, [live, career, onComplete]);

  if (!sched || !live) return null;

  const userName = career.club;
  const oppName = sched.opponent;

  return (
    <div className={SPACING.stackLg}>
      <div className={`${CARD.elevated} ${SPACING.cardPadding} text-center`}>
        <p className={TYPO.sectionLabel}>
          {sched.isHome ? "Home" : "Away"} · Game Week {sched.round}
        </p>
        <p className={`mt-2 text-2xl font-bold text-white sm:text-3xl`}>
          {userName}{" "}
          <span className="text-theme-primary">{live.userScore}</span>
          <span className="mx-2 text-pitch-500">-</span>
          <span className="text-theme-primary">{live.oppScore}</span>{" "}
          {oppName}
        </p>
        <p className={`mt-1 font-mono text-lg text-accent-gold`}>
          {live.minute}:00
          {live.isComplete ? " · Full Time" : ""}
        </p>
      </div>

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={TYPO.sectionLabel}>Current Command</p>
        <p className="mt-1 font-medium text-white">
          {getLiveCommandLabel(live.command)}
        </p>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          Effectiveness: {live.effectivenessLine}
        </p>
        <p className={`mt-2 text-xs text-pitch-500`}>
          Momentum: {live.momentum > 0 ? "+" : ""}
          {live.momentum}
        </p>
      </div>

      {!live.isComplete && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={`${TYPO.sectionLabel} mb-2`}>Match Commands</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COMMANDS.map((cmd) => (
              <GameButton
                key={cmd}
                variant={live.command === cmd ? "theme" : "secondary"}
                size="sm"
                onClick={() => {
                  playUiClick();
                  advance(cmd);
                }}
              >
                {getLiveCommandLabel(cmd)}
              </GameButton>
            ))}
          </div>
        </div>
      )}

      <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
        <p className={TYPO.sectionLabel}>Recent Events</p>
        {live.events.length === 0 ? (
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
            No events yet — issue a command to play on.
          </p>
        ) : (
          <ul className={`mt-2 max-h-40 overflow-y-auto ${SPACING.stackSm}`}>
            {[...live.events].reverse().map((ev, i) => (
              <li key={`${ev.minute}-${i}`} className={`${TYPO.bodySm}`}>
                {ev.description}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {live.isComplete ? (
          <GameButton variant="theme" onClick={finishMatch}>
            View Match Review
          </GameButton>
        ) : (
          <GameButton
            variant="theme"
            onClick={() => advance(live.command)}
          >
            Advance +5 min
          </GameButton>
        )}
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
    </div>
  );
}
