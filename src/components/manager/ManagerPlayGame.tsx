"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
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
  LIVE_MATCH_COMMANDS,
  liveMatchToFixture,
  REAL_TICK_MS,
  type LiveMatchState,
} from "@/lib/manager/managerLiveMatch";
import {
  applyManagerMatchResult,
  getNextManagerFixture,
  prepareCareerForNextMatch,
} from "@/lib/manager/managerSimulation";
import { formatTacticsLabel } from "@/lib/manager/managerTacticsCopy";
import { ManagerCompetitionBadge } from "@/components/manager/ManagerCompetitionBadge";
import {
  getManagerScheduledFixtureHeadline,
  getManagerScheduledFixtureVenueLabel,
} from "@/lib/manager/managerFixtureDisplay";
import { computeManagerTeamRating } from "@/lib/manager/managerRating";
import { getOpponentMatchRating } from "@/lib/game/opponent-scorers";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import { playSimulateRound, playUiClick } from "@/lib/sound";

const COMMANDS = LIVE_MATCH_COMMANDS;

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
  const readyCareer = career;
  const sched = getNextManagerFixture(readyCareer);
  const fixtureKey = sched?.id ?? "none";
  const [live, setLive] = useState<LiveMatchState | null>(null);
  const [command, setCommand] = useState<LiveMatchCommand>("balanced");
  const [clockRunning, setClockRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [abandonConfirmOpen, setAbandonConfirmOpen] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
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
      const result = applyManagerMatchResult(
        prepareCareerForNextMatch(careerRef.current),
        fixture,
        {
          playedLive: true,
          schedOverride: sched ?? undefined,
          liveEvents: getLiveMatchEvents(finalState),
        }
      );
      if (!result.ok) {
        finishedRef.current = false;
        setApplyError(result.error);
        return;
      }
      onComplete(result.career);
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
    if (hasStarted) {
      setAbandonConfirmOpen(true);
      return;
    }
    onCancel();
  };

  const confirmAbandon = () => {
    setAbandonConfirmOpen(false);
    onCancel();
  };

  const handleEscapeClose = useCallback(() => {
    if (hasStarted) {
      setAbandonConfirmOpen(true);
      return;
    }
    onCancel();
  }, [hasStarted, onCancel]);

  const panelRef = useModalA11y(true, handleEscapeClose);

  const handleSimulateToFullTime = () => {
    if (!live || live.isComplete) return;
    playSimulateRound();
    setClockRunning(false);
    const tacticCommand = commandFromTactics(careerRef.current);
    commandRef.current = tacticCommand;
    setCommand(tacticCommand);
    setLive(advanceLiveToFullTime(live, careerRef.current, tacticCommand));
    setHasStarted(true);
  };

  if (!sched || !live) {
    return (
      <div
        ref={panelRef}
        tabIndex={-1}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 outline-none"
        role="dialog"
        aria-modal="true"
        aria-label="Live match unavailable"
      >
        <div className={`${CARD.elevated} max-w-md w-full p-6 text-center space-y-4`}>
          <h2 className={TYPO.viewTitle}>No fixture ready</h2>
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            Your next match could not be loaded. Check your squad selection and
            try again from the hub.
          </p>
          <GameButton onClick={onCancel}>Back to hub</GameButton>
        </div>
      </div>
    );
  }

  const userRating = computeManagerTeamRating(
    career.matchdayXiii,
    career.matchdayInterchange,
    career.xiiiSlotPositions,
    career
  );
  const oppRating = Math.round(
    getOpponentMatchRating(sched.opponent, career.seed, sched.round, {
      currentSeasonOnly: sched.competition !== "friendly",
    })
  );

  const homeName = live.isHome ? career.club : sched.opponent;
  const awayName = live.isHome ? sched.opponent : career.club;
  const homeScore = live.isHome ? live.userScore : live.oppScore;
  const awayScore = live.isHome ? live.oppScore : live.userScore;
  const status = getMatchStatusLabel(live.userScore, live.oppScore, live.isHome);
  const isPreview = live.phase === "preview";
  const isHalftime = live.phase === "halftime";
  const matchEvents = [...live.events].reverse();

  const selectCommand = (cmd: LiveMatchCommand) => {
    playUiClick();
    setCommand(cmd);
  };

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-black/85 backdrop-blur-sm outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Live match"
    >
      <div
        className={`card-glass mx-auto flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden ${SPACING.cardPaddingSm}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scoreboard */}
        <header className="shrink-0 border-b border-pitch-700/50 pb-2 text-center">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-pitch-400">
              {getManagerScheduledFixtureHeadline(sched)} ·{" "}
              {getManagerScheduledFixtureVenueLabel(sched)}
            </p>
            <ManagerCompetitionBadge
              competition={sched.competition}
              cupRound={sched.cupRound}
            />
          </div>

          <p className="mt-1.5 truncate text-base font-bold leading-tight text-white sm:text-lg">
            <span className={live.isHome ? "text-theme-primary" : ""}>
              {homeName}
            </span>{" "}
            <span className="text-theme-primary tabular-nums">
              {homeScore}-{awayScore}
            </span>{" "}
            <span className={!live.isHome ? "text-theme-primary" : ""}>
              {awayName}
            </span>
          </p>

          {!isPreview && (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <span className="font-mono text-sm font-bold text-accent-gold tabular-nums">
                {formatLiveClock(live.minute)}
                {live.isComplete
                  ? " FT"
                  : isHalftime
                    ? " HT"
                    : ""}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_PILL_CLASS[status.tone]}`}
              >
                {status.pill}
              </span>
            </div>
          )}
          {!isPreview && !isHalftime && (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-pitch-400">
              {status.line}
            </p>
          )}
        </header>

        {/* Main — fills viewport, no scroll */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden py-2">
          {isPreview && (
            <div className={`${CARD.inset} shrink-0 ${SPACING.cardPaddingSm}`}>
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                <span>
                  {career.club}:{" "}
                  <strong className="text-theme-primary">{userRating}</strong>
                </span>
                <span>
                  {sched.opponent}: <strong>{oppRating}</strong>
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-center text-[11px] text-pitch-400">
                {formatTacticsLabel(career.tactics)}
              </p>
            </div>
          )}

          {isHalftime && (
            <div className="shrink-0 space-y-2">
              <p className={`${TYPO.bodySm} line-clamp-2 text-pitch-300`}>
                {live.effectivenessLine}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
                Second half command
              </p>
              <CommandGrid command={command} onSelect={selectCommand} />
            </div>
          )}

          {!isPreview && !isHalftime && !live.isComplete && (
            <div className="shrink-0 space-y-2">
              <p className="line-clamp-1 text-[11px] text-pitch-400">
                <span className="font-medium text-white">
                  {getLiveCommandLabel(command)}
                </span>
                {" · "}
                {live.effectivenessLine}
              </p>
              <CommandGrid command={command} onSelect={selectCommand} />
            </div>
          )}

          {live.isComplete && (
            <p className={`shrink-0 text-center ${TYPO.bodySm} text-pitch-300`}>
              {live.effectivenessLine}
            </p>
          )}

          {/* Events — scroll within available space */}
          <div
            className={`${CARD.inset} flex min-h-0 flex-1 flex-col overflow-hidden ${SPACING.cardPaddingSm}`}
          >
            <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
              Match events
              {matchEvents.length > 0 && (
                <span className="ml-1.5 font-normal normal-case text-pitch-600">
                  ({matchEvents.length})
                </span>
              )}
            </p>
            {matchEvents.length === 0 ? (
              <p className="mt-2 text-[11px] text-pitch-500">
                {isPreview
                  ? "Events appear once the match starts."
                  : "Waiting for action…"}
              </p>
            ) : (
              <ul className="mt-1.5 min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-pitch-600/80">
                {matchEvents.map((ev, i) => (
                  <li
                    key={`${ev.minute}-${ev.type}-${i}`}
                    className={`text-[11px] leading-snug sm:text-xs ${
                      ev.team === "user" ? "text-white" : "text-pitch-400"
                    }`}
                  >
                    <span className="font-mono text-pitch-500">
                      {ev.minute}&apos;
                    </span>{" "}
                    {ev.description}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Actions */}
        <footer className="shrink-0 space-y-2 border-t border-pitch-700/50 pt-2">
          {isPreview && (
            <div className="grid grid-cols-2 gap-2">
              <GameButton variant="theme" size="sm" onClick={handleStartGame}>
                Start
              </GameButton>
              <GameButton
                variant="secondary"
                size="sm"
                onClick={handleSimulateToFullTime}
              >
                Sim to FT
              </GameButton>
              <GameButton
                variant="secondary"
                size="sm"
                className="col-span-2"
                onClick={handleAbandon}
              >
                Close
              </GameButton>
            </div>
          )}

          {isHalftime && (
            <GameButton variant="theme" size="sm" onClick={handleStartSecondHalf}>
              Start second half
            </GameButton>
          )}

          {!isPreview && !isHalftime && !live.isComplete && (
            <GameButton
              variant="secondary"
              size="sm"
              onClick={handleSimulateToFullTime}
            >
              Simulate to full time
            </GameButton>
          )}

          {live.isComplete && (
            <GameButton variant="theme" size="sm" onClick={() => finishMatch(live)}>
              View match review
            </GameButton>
          )}

          {hasStarted && !live.isComplete && (
            <GameButton variant="secondary" size="sm" onClick={handleAbandon}>
              Abandon match
            </GameButton>
          )}
        </footer>
      </div>

      <ManagerDialog
        open={applyError !== null}
        title="Match not saved"
        message={
          applyError ??
          "This result could not be applied. Return to the hub and try again."
        }
        confirmLabel="Back to hub"
        onConfirm={() => {
          setApplyError(null);
          onCancel();
        }}
        onCancel={() => {
          setApplyError(null);
          onCancel();
        }}
      />

      <ManagerDialog
        open={abandonConfirmOpen}
        variant="confirm"
        destructive
        title="Abandon match"
        message="Abandon this match? Progress will be lost."
        confirmLabel="Abandon"
        cancelLabel="Keep playing"
        onConfirm={confirmAbandon}
        onCancel={() => setAbandonConfirmOpen(false)}
      />
    </div>
  );
}

function CommandGrid({
  command,
  onSelect,
}: {
  command: LiveMatchCommand;
  onSelect: (cmd: LiveMatchCommand) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {COMMANDS.map((cmd) => (
        <button
          key={cmd}
          type="button"
          onClick={() => onSelect(cmd)}
          className={`btn-press min-h-[44px] rounded-lg border px-1 py-1.5 text-[10px] font-bold uppercase leading-tight tracking-wide transition sm:min-h-[40px] sm:text-[11px] ${
            command === cmd
              ? "border-theme-primary bg-theme-primary/15 text-theme-primary ring-1 ring-theme-primary/30"
              : "border-pitch-600/80 bg-pitch-900/60 text-pitch-300 hover:border-pitch-500 hover:text-white"
          }`}
        >
          {getLiveCommandLabel(cmd)}
        </button>
      ))}
    </div>
  );
}
