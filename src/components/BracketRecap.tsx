"use client";

import { useEffect, useMemo, useState } from "react";
import type { BracketMatch } from "@/lib/game/challenge-cup-bracket";
import { getCupRoundLabel } from "@/lib/game/challenge-cup-bracket";
import {
  getExpandedCupRoundLabel,
  type ExpandedCupMeta,
} from "@/lib/manager/championship/championshipChallengeCup";
import { getReadableTextColor } from "@/lib/ui/contrast";
import { UI_SURFACES } from "@/lib/ui/surfaces";
import { playUiClick } from "@/lib/sound";
import { BracketMobileRoundNav } from "./BracketMobileRoundNav";
import { ClubDualSwatch } from "./ClubDualSwatch";

interface BracketRecapProps {
  matches: BracketMatch[];
  userClub: string;
  byeTeams?: [string, string];
  /** Expanded Challenge Cup Round One byes (16 clubs). */
  expandedMeta?: ExpandedCupMeta;
  /** Display density — Hub uses hub-compact. */
  variant?: "full" | "hub-compact" | "mobile-round";
  /** When set (compact Hub), prefer showing this round on mobile. */
  focusRound?: number;
  onSelectCompletedUserMatch?: (cupMatchId: string) => void;
  onSelectUpcomingUserMatch?: (cupMatchId: string) => void;
  onSelectAiMatch?: (cupMatchId: string) => void;
}

/** User-club highlight: sky ring — not Current green or Era gold. Club colours stay on the swatch. */
const USER_CLUB_RING =
  "ring-2 ring-sky-400/70 ring-offset-1 ring-offset-pitch-950";
const USER_MATCH_SHELL =
  "border-sky-400/45 bg-sky-950/25 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.18)]";

function detectMaxRound(matches: BracketMatch[]): number {
  return Math.max(4, ...matches.map((m) => m.round));
}

function getRoundLabel(round: number, expanded: boolean): string {
  return expanded ? getExpandedCupRoundLabel(round) : getCupRoundLabel(round);
}

function getShortLabel(round: number, maxRound: number): string {
  if (maxRound >= 6) {
    const map: Record<number, string> = {
      1: "R1",
      2: "R2",
      3: "L16",
      4: "QF",
      5: "SF",
      6: "F",
    };
    return map[round] ?? String(round);
  }
  const map: Record<number, string> = { 1: "R16", 2: "QF", 3: "SF", 4: "F" };
  return map[round] ?? String(round);
}

function getActiveRoundFromMatches(
  matches: BracketMatch[],
  maxRound: number
): number {
  for (let round = 1; round <= maxRound; round++) {
    if (
      matches
        .filter((m) => m.round === round)
        .some((match) => match.status === "ready")
    ) {
      return round;
    }
  }
  return maxRound;
}

function CupRoundTitle({
  round,
  activeRound,
  maxRound,
  expanded,
}: {
  round: number;
  activeRound: number;
  maxRound: number;
  expanded: boolean;
}) {
  const isFinal = round === maxRound;
  const isLive = round === activeRound;

  return (
    <div
      className={`playoff-bracket-round-title mb-3 ${
        isFinal ? "playoff-bracket-round-title--final" : ""
      } ${isLive ? "playoff-bracket-round-title--live" : ""}`}
    >
      <span className="playoff-bracket-round-title__short">
        {getShortLabel(round, maxRound)}
      </span>
      <span className="playoff-bracket-round-title__label">
        {getRoundLabel(round, expanded)}
      </span>
    </div>
  );
}

function ByeClubChip({ club, userClub }: { club: string; userClub: string }) {
  const isUser = club === userClub;
  return (
    <li
      className={`flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-semibold text-white md:text-xs ${
        isUser ? USER_CLUB_RING : ""
      }`}
    >
      <ClubDualSwatch club={club} size="xs" />
      <span className="truncate text-white">{club}</span>
      {isUser ? (
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-sky-300">
          You
        </span>
      ) : null}
    </li>
  );
}

export function BracketRecap({
  matches,
  userClub,
  byeTeams,
  expandedMeta,
  variant = "full",
  focusRound,
  onSelectCompletedUserMatch,
  onSelectUpcomingUserMatch,
  onSelectAiMatch,
}: BracketRecapProps) {
  const maxRound = detectMaxRound(matches);
  const expanded = maxRound >= 6 || expandedMeta?.schemaVersion === 2;
  const rounds = useMemo(
    () => Array.from({ length: maxRound }, (_, i) => i + 1),
    [maxRound]
  );
  const activeRound = getActiveRoundFromMatches(matches, maxRound);
  const [viewRound, setViewRound] = useState(focusRound ?? activeRound);
  const compact = variant === "hub-compact";

  useEffect(() => {
    if (focusRound != null) {
      setViewRound(focusRound);
      return;
    }
    setViewRound((prev) => (prev < activeRound ? activeRound : prev));
  }, [activeRound, focusRound]);

  const mobileRoundMatches = matches.filter((m) => m.round === viewRound);
  const roundOneByes = expandedMeta?.roundOneByes ?? [];
  const desktopRounds = compact
    ? Array.from(
        new Set(
          rounds.filter(
            (r) =>
              r === activeRound ||
              r === activeRound - 1 ||
              r === activeRound + 1 ||
              r === maxRound
          )
        )
      ).sort((a, b) => a - b)
    : rounds;

  return (
    <div className="manager-cup-bracket-breakout min-w-0">
      <BracketMobileRoundNav
        rounds={rounds}
        viewRound={viewRound}
        activeRound={activeRound}
        onViewRoundChange={setViewRound}
        getLabel={(round) => getRoundLabel(round, expanded)}
        getShortLabel={(round) => getShortLabel(round, maxRound)}
        activeClassName="border-sky-400/55 bg-sky-500/12 text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.12)]"
      />

      {expanded && viewRound === 1 && roundOneByes.length > 0 ? (
        <div className="mt-3 rounded-lg border border-pitch-600/40 bg-pitch-900/40 p-3 md:hidden">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
            Bye to Round Two
          </p>
          <ul className="grid grid-cols-2 gap-1.5">
            {roundOneByes.map((club) => (
              <ByeClubChip key={club} club={club} userClub={userClub} />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 md:hidden">
        <CupRoundTitle
          round={viewRound}
          activeRound={activeRound}
          maxRound={maxRound}
          expanded={expanded}
        />
        <div className="space-y-3.5">
          {mobileRoundMatches.map((match) => (
            <RecapMatch
              key={match.id}
              match={match}
              userClub={userClub}
              byeTeams={byeTeams}
              expanded={expanded}
              mobile
              onSelectCompletedUserMatch={onSelectCompletedUserMatch}
              onSelectUpcomingUserMatch={onSelectUpcomingUserMatch}
              onSelectAiMatch={onSelectAiMatch}
            />
          ))}
        </div>
        {viewRound < activeRound && (
          <p className="mt-3 text-center text-xs text-pitch-500">
            Round complete — use the tabs above to review earlier ties
          </p>
        )}
      </div>

      <div className="hidden overflow-x-auto pb-2 md:block">
        {expanded && roundOneByes.length > 0 && !compact ? (
          <div className="mb-4 rounded-lg border border-pitch-600/40 bg-pitch-900/35 p-3">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-sky-300">
              Round One — Bye to Round Two
            </p>
            <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {roundOneByes.map((club) => (
                <ByeClubChip key={club} club={club} userClub={userClub} />
              ))}
            </ul>
          </div>
        ) : null}
        <div
          className={`mx-auto flex items-stretch justify-center gap-3 ${
            expanded && !compact
              ? "min-w-[72rem] max-w-none px-2"
              : compact
                ? "w-full min-w-0 max-w-5xl gap-2"
                : "w-full min-w-0 max-w-4xl gap-2"
          }`}
        >
          {desktopRounds.map((round) => {
            const roundMatches = matches.filter((m) => m.round === round);
            return (
              <div
                key={round}
                className={`cup-bracket-column flex flex-col ${
                  expanded && !compact
                    ? "min-w-[10.5rem] flex-none"
                    : "min-w-0 flex-1"
                }`}
              >
                <p className="mb-2 text-center font-display text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:text-[11px]">
                  {getRoundLabel(round, expanded)}
                </p>
                <div className="flex flex-1 flex-col justify-around gap-2.5">
                  {roundMatches.map((match) => (
                    <RecapMatch
                      key={match.id}
                      match={match}
                      userClub={userClub}
                      byeTeams={byeTeams}
                      expanded={expanded}
                      onSelectCompletedUserMatch={onSelectCompletedUserMatch}
                      onSelectUpcomingUserMatch={onSelectUpcomingUserMatch}
                      onSelectAiMatch={onSelectAiMatch}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RecapMatch({
  match,
  userClub,
  byeTeams,
  expanded,
  mobile = false,
  onSelectCompletedUserMatch,
  onSelectUpcomingUserMatch,
  onSelectAiMatch,
}: {
  match: BracketMatch;
  userClub: string;
  byeTeams?: [string, string];
  expanded?: boolean;
  mobile?: boolean;
  onSelectCompletedUserMatch?: (cupMatchId: string) => void;
  onSelectUpcomingUserMatch?: (cupMatchId: string) => void;
  onSelectAiMatch?: (cupMatchId: string) => void;
}) {
  const involvesUser =
    match.isUserMatch ||
    match.homeTeam === userClub ||
    match.awayTeam === userClub ||
    match.winner === userClub ||
    match.loser === userClub;

  const handleActivate = () => {
    if (match.status === "complete" && match.isUserMatch) {
      onSelectCompletedUserMatch?.(match.id);
      return;
    }
    if (
      (match.status === "ready" || match.status === "pending") &&
      match.isUserMatch &&
      match.homeTeam &&
      match.awayTeam
    ) {
      onSelectUpcomingUserMatch?.(match.id);
      return;
    }
    if (match.status === "complete" && !match.isUserMatch) {
      onSelectAiMatch?.(match.id);
    }
  };

  const interactive =
    (match.status === "complete" &&
      match.isUserMatch &&
      !!onSelectCompletedUserMatch) ||
    (match.status !== "complete" &&
      match.isUserMatch &&
      !!match.homeTeam &&
      !!match.awayTeam &&
      !!onSelectUpcomingUserMatch) ||
    (match.status === "complete" &&
      !match.isUserMatch &&
      !!onSelectAiMatch);

  if (match.status !== "complete") {
    const home = match.homeTeam;
    const away = match.awayTeam;
    if (home || away) {
      const body = (
        <>
          <RecapTeam
            team={home}
            score={null}
            winner={false}
            loser={false}
            userClub={userClub}
            mobile={mobile}
          />
          <div className="border-t border-pitch-600/20" />
          <RecapTeam
            team={away}
            score={null}
            winner={false}
            loser={false}
            userClub={userClub}
            mobile={mobile}
          />
        </>
      );
      const shellClass = `cup-bracket-match rounded-lg border ${
        involvesUser
          ? USER_MATCH_SHELL
          : "border-pitch-600/40 bg-pitch-900/40"
      } ${mobile ? "px-0 py-0.5 shadow-sm shadow-black/20" : "px-0 py-0"}`;

      if (interactive) {
        return (
          <button
            type="button"
            className={`${shellClass} w-full text-left transition hover:brightness-110`}
            onClick={() => {
              playUiClick();
              handleActivate();
            }}
          >
            {body}
          </button>
        );
      }
      return <div className={shellClass}>{body}</div>;
    }
    return (
      <div
        className={`rounded-lg border border-pitch-600/30 bg-pitch-900/30 opacity-40 ${
          involvesUser ? USER_CLUB_RING : ""
        } ${mobile ? "px-3 py-3" : "px-2 py-2"}`}
      >
        <p className={`${mobile ? "text-xs" : "text-[9px]"} text-gray-600`}>
          {involvesUser ? `${userClub} path` : "—"}
        </p>
      </div>
    );
  }

  const shellClass = `cup-bracket-match rounded-lg border px-0 py-0 ${
    involvesUser
      ? USER_MATCH_SHELL
      : "border-pitch-600/30 bg-pitch-900/40"
  } ${mobile ? "py-0.5 shadow-sm shadow-black/20" : ""}`;

  const body = (
    <>
      <RecapTeam
        team={match.homeTeam}
        score={match.homeScore}
        winner={match.winner === match.homeTeam}
        loser={match.loser === match.homeTeam}
        userClub={userClub}
        showByeAdvance={
          !expanded &&
          !!byeTeams &&
          match.round === 2 &&
          (match.feederIds?.length ?? 0) === 1 &&
          match.homeTeam !== null &&
          byeTeams.includes(match.homeTeam)
        }
        mobile={mobile}
      />
      <div className="border-t border-pitch-600/20" />
      <RecapTeam
        team={match.awayTeam}
        score={match.awayScore}
        winner={match.winner === match.awayTeam}
        loser={match.loser === match.awayTeam}
        userClub={userClub}
        showByeAdvance={false}
        mobile={mobile}
      />
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={`${shellClass} w-full text-left transition hover:brightness-110`}
        onClick={() => {
          playUiClick();
          handleActivate();
        }}
      >
        {body}
      </button>
    );
  }

  return <div className={shellClass}>{body}</div>;
}

function RecapTeam({
  team,
  score,
  winner,
  loser,
  userClub,
  showByeAdvance,
  mobile = false,
}: {
  team: string | null;
  score: number | null;
  winner: boolean;
  loser: boolean;
  userClub: string;
  showByeAdvance?: boolean;
  mobile?: boolean;
}) {
  if (!team) {
    return (
      <div className={`${mobile ? "px-3 py-2" : "px-2.5 py-1.5"}`}>
        <span className="text-[10px] italic text-pitch-500">TBD</span>
      </div>
    );
  }
  const isUser = team === userClub;

  const teamTextColor = loser
    ? "#6b7280"
    : getReadableTextColor(
        winner ? UI_SURFACES.bracketWinner : UI_SURFACES.bracketRow
      );

  return (
    <div
      className={`${mobile ? "px-3.5 py-2.5" : "px-2.5 py-1.5"} ${
        winner ? "bg-theme-primary/10" : loser ? "opacity-50" : ""
      } ${isUser ? "relative" : ""}`}
    >
      <div
        className={`flex items-center gap-2 rounded-sm ${
          isUser ? `-mx-1 px-1 ${USER_CLUB_RING}` : ""
        }`}
      >
        <ClubDualSwatch club={team} size={mobile ? "sm" : "xs"} />
        <span
          className={`min-w-0 flex-1 break-words font-bold leading-snug text-white ${
            mobile ? "text-[13px]" : "text-[11px]"
          }`}
          style={
            !isUser && loser
              ? { color: teamTextColor }
              : !isUser && winner
                ? { color: teamTextColor }
                : undefined
          }
        >
          {team}
        </span>
        {score !== null && (
          <span
            className={`font-bold tabular-nums ${
              mobile ? "text-base" : "text-xs"
            } ${winner ? "text-theme-primary" : "text-gray-500"}`}
          >
            {score}
          </span>
        )}
      </div>
      {showByeAdvance && (
        <p
          className={`mt-0.5 font-semibold uppercase tracking-wide text-sky-300/90 ${
            mobile ? "pl-7 text-[9px]" : "pl-6 text-[7px]"
          }`}
        >
          Bye to Quarter Finals
        </p>
      )}
    </div>
  );
}
