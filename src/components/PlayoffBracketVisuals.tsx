"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { PlayoffBracketMatch } from "@/lib/game/playoff-bracket";
import { getPlayoffRoundLabel, getPlayoffTeamDisplayInfo } from "@/lib/game/playoff-bracket";
import { DREAM_TEAM_NAME } from "@/lib/game/season-simulation";
import { ClubDualSwatch } from "./ClubDualSwatch";

export const PLAYOFF_ROUND_SHORT: Record<number, string> = {
  1: "EF",
  2: "SF",
  3: "GF",
};

const PLAYOFF_ROUNDS = [
  { round: 1, short: "EF" },
  { round: 2, short: "SF" },
  { round: 3, short: "GF" },
] as const;

export function PlayoffBracketProgressStrip({
  activeRound,
  tournamentComplete,
  compact = false,
}: {
  activeRound: number;
  tournamentComplete: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className={`playoff-bracket-progress ${compact ? "mt-0" : "mx-auto mt-5 max-w-md"}`}>
        {PLAYOFF_ROUNDS.map(({ round, short }, index) => {
          const isFinal = round === 3;
          const isComplete = tournamentComplete || activeRound > round;
          const isLive = !tournamentComplete && activeRound === round;

          return (
            <div key={round} className="playoff-bracket-progress__step">
              {index > 0 && (
                <span
                  className={`playoff-bracket-progress__line ${
                    isComplete ? "playoff-bracket-progress__line--done" : ""
                  }`}
                  aria-hidden
                />
              )}
              <div
                className={`playoff-bracket-progress__node ${
                  isFinal ? "playoff-bracket-progress__node--final" : ""
                } ${isComplete ? "playoff-bracket-progress__node--done" : ""} ${
                  isLive ? "playoff-bracket-progress__node--live" : ""
                }`}
              >
                <span className="font-display text-[10px] font-black uppercase tracking-wider">
                  {short}
                </span>
              </div>
              <p
                className={`mt-1.5 text-[9px] font-semibold uppercase tracking-wider ${
                  compact ? "hidden sm:block" : "hidden sm:block"
                } ${
                  isLive
                    ? isFinal
                      ? "text-accent-gold"
                      : "text-mode-current"
                    : isComplete
                      ? "text-gray-400"
                      : "text-gray-600"
                }`}
              >
                {getPlayoffRoundLabel(round)}
              </p>
            </div>
          );
        })}
      </div>

      <div
        className={`flex flex-wrap items-center justify-center gap-2 ${
          compact ? "" : "mx-auto max-w-lg"
        }`}
      >
        <span className="playoff-bracket-tag">
          1st & 2nd receive a semi-final bye
        </span>
        <span className="playoff-bracket-tag playoff-bracket-tag--muted">
          3v6 · 4v5 eliminators → semis → final
        </span>
      </div>
    </div>
  );
}

export function PlayoffBracketHeader({
  activeRound,
  tournamentComplete,
}: {
  activeRound: number;
  tournamentComplete: boolean;
}) {
  return (
    <div className="playoff-bracket-header matchday-panel overflow-hidden px-4 py-5 text-center sm:px-6 sm:py-6">
      <div className="playoff-bracket-header__shine pointer-events-none" aria-hidden />
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.4em] text-mode-current sm:text-xs">
        Super League Play-Offs
      </p>
      <h2 className="mt-2 font-display text-2xl font-black tracking-tight text-white sm:text-3xl">
        Knockout Bracket
      </h2>
      <p className="mt-2 text-sm text-gray-400">
        {tournamentComplete
          ? "Play-offs complete — review the path to the trophy"
          : `${getPlayoffRoundLabel(activeRound)} — simulate matches to advance`}
      </p>

      <PlayoffBracketProgressStrip
        activeRound={activeRound}
        tournamentComplete={tournamentComplete}
      />
    </div>
  );
}

export function PlayoffChampionBanner({ champion }: { champion: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="playoff-champion-banner mb-5 px-4 py-4 text-center sm:px-5 sm:py-5"
    >
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.35em] text-accent-gold/80">
        Super League Champions
      </p>
      <p className="mt-1 font-display text-lg font-black text-accent-gold sm:text-xl">
        {champion}
      </p>
    </motion.div>
  );
}

export function PlayoffRoundTitle({
  round,
  activeRound,
}: {
  round: number;
  activeRound: number;
}) {
  const isFinal = round === 3;
  const isLive = round === activeRound;

  return (
    <div
      className={`playoff-bracket-round-title mb-3 ${
        isFinal ? "playoff-bracket-round-title--final" : ""
      } ${isLive ? "playoff-bracket-round-title--live" : ""}`}
    >
      <span className="playoff-bracket-round-title__short">
        {PLAYOFF_ROUND_SHORT[round] ?? round}
      </span>
      <span className="playoff-bracket-round-title__label">
        {getPlayoffRoundLabel(round)}
      </span>
    </div>
  );
}

export function PlayoffMatchCard({
  match,
  selected,
  onSelect,
  isActiveRound,
  interactive = true,
  mobile = false,
  userClub = DREAM_TEAM_NAME,
}: {
  match: PlayoffBracketMatch;
  selected: boolean;
  onSelect: () => void;
  isActiveRound: boolean;
  interactive?: boolean;
  mobile?: boolean;
  userClub?: string;
}) {
  const isComplete = match.status === "complete";
  const isReady = match.status === "ready";
  const isPending = match.status === "pending";
  const isFinal = match.round === 3;
  const canInteract = interactive && !isPending;

  const footerBadge = isPending
    ? { text: "Awaiting teams", tone: "muted" as const }
    : isReady && isActiveRound && interactive
      ? { text: "Tap to simulate", tone: "live" as const }
      : isComplete && !selected && interactive
        ? { text: "View details", tone: "muted" as const }
        : null;

  return (
    <motion.button
      type="button"
      layout
      onClick={onSelect}
      disabled={!canInteract}
      whileTap={canInteract ? { scale: 0.985 } : undefined}
      className={`playoff-bracket-match w-full text-left ${
        mobile ? "playoff-bracket-match--mobile" : ""
      } ${isFinal ? "playoff-bracket-match--final" : ""} ${
        selected ? "playoff-bracket-match--selected" : ""
      } ${isReady && isActiveRound ? "playoff-bracket-match--ready" : ""} ${
        isPending ? "playoff-bracket-match--pending" : ""
      } ${canInteract ? "cursor-pointer" : "cursor-default"}`}
    >
      {match.isUserMatch && (isReady || isComplete) && (
        <div className="playoff-bracket-match__ribbon">Your match</div>
      )}

      <PlayoffTeamRow
        match={match}
        side="home"
        score={match.homeScore}
        isWinner={isComplete && match.winner === match.homeTeam}
        isLoser={isComplete && match.loser === match.homeTeam}
        isUser={match.homeTeam === userClub}
        mobile={mobile}
      />

      <div className="playoff-bracket-divider" aria-hidden />

      <PlayoffTeamRow
        match={match}
        side="away"
        score={match.awayScore}
        isWinner={isComplete && match.winner === match.awayTeam}
        isLoser={isComplete && match.loser === match.awayTeam}
        isUser={match.awayTeam === userClub}
        mobile={mobile}
      />

      {footerBadge && (
        <div className="playoff-bracket-match__footer">
          <span
            className={`playoff-bracket-match__badge playoff-bracket-match__badge--${footerBadge.tone}`}
          >
            {footerBadge.text}
          </span>
        </div>
      )}
    </motion.button>
  );
}

function PlayoffTeamRow({
  match,
  side,
  score,
  isWinner,
  isLoser,
  isUser,
  mobile = false,
}: {
  match: PlayoffBracketMatch;
  side: "home" | "away";
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  isUser: boolean;
  mobile?: boolean;
}) {
  const display = getPlayoffTeamDisplayInfo(match, side);
  const label = display.text;
  const isPending = display.isPlaceholder;
  const swatchClub =
    !isPending && match[side === "home" ? "homeTeam" : "awayTeam"]
      ? match[side === "home" ? "homeTeam" : "awayTeam"]!
      : "Wigan Warriors";

  return (
    <div
      className={`playoff-bracket-team ${
        isWinner ? "playoff-bracket-team--winner" : ""
      } ${isLoser ? "playoff-bracket-team--loser" : ""} ${
        mobile ? "playoff-bracket-team--mobile" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {!isPending ? (
          <ClubDualSwatch club={swatchClub} size="xs" />
        ) : (
          <span className="h-3 w-3 shrink-0 rounded-full bg-pitch-700/80 ring-1 ring-pitch-600/50" />
        )}
        <div className="min-w-0 flex-1">
          <span
            className={`block font-semibold leading-snug [overflow-wrap:anywhere] ${
              mobile ? "text-xs" : "text-[11px] sm:text-xs"
            } ${
              isUser
                ? "text-mode-current"
                : isPending
                  ? "italic text-gray-500"
                  : isWinner
                    ? "text-white"
                    : "text-gray-200"
            }`}
          >
            {label}
          </span>
          {display.hasLeagueBye && (
            <span className="playoff-bracket-bye-badge">League bye</span>
          )}
        </div>
      </div>
      <span
        className={`playoff-bracket-score ${
          isWinner ? "playoff-bracket-score--winner" : ""
        } ${score === null ? "playoff-bracket-score--empty" : ""}`}
      >
        {score !== null ? score : "—"}
      </span>
    </div>
  );
}

export function PlayoffBracketColumnShell({
  round,
  activeRound,
  children,
}: {
  round: number;
  activeRound: number;
  children: ReactNode;
}) {
  const isFinal = round === 3;

  return (
    <div
      className={`playoff-bracket-column cup-bracket-column relative flex min-h-0 flex-col ${
        isFinal ? "playoff-bracket-column--final" : ""
      } ${round === activeRound ? "playoff-bracket-column--live" : ""}`}
    >
      <PlayoffRoundTitle round={round} activeRound={activeRound} />
      <div className="playoff-bracket-track">{children}</div>
    </div>
  );
}

export function PlayoffBracketDesktop({
  rounds,
  activeRound,
  getMatches,
  renderMatch,
}: {
  rounds: readonly number[];
  activeRound: number;
  getMatches: (round: number) => PlayoffBracketMatch[];
  renderMatch: (match: PlayoffBracketMatch, round: number) => ReactNode;
}) {
  return (
    <div className="playoff-bracket-desktop">
      {rounds.map((round) => (
        <PlayoffBracketColumnShell
          key={round}
          round={round}
          activeRound={activeRound}
        >
          {getMatches(round).map((match) => (
            <div
              key={match.id}
              className="playoff-bracket-slot"
              data-round={round}
              data-slot={match.slot}
            >
              {renderMatch(match, round)}
            </div>
          ))}
        </PlayoffBracketColumnShell>
      ))}
    </div>
  );
}
