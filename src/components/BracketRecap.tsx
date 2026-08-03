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
import { BracketMobileRoundNav } from "./BracketMobileRoundNav";
import { ClubDualSwatch } from "./ClubDualSwatch";

interface BracketRecapProps {
  matches: BracketMatch[];
  userClub: string;
  byeTeams?: [string, string];
  /** Expanded Challenge Cup Round One byes (16 clubs). */
  expandedMeta?: ExpandedCupMeta;
}

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

export function BracketRecap({
  matches,
  userClub,
  byeTeams,
  expandedMeta,
}: BracketRecapProps) {
  const maxRound = detectMaxRound(matches);
  const expanded = maxRound >= 6 || expandedMeta?.schemaVersion === 2;
  const rounds = useMemo(
    () => Array.from({ length: maxRound }, (_, i) => i + 1),
    [maxRound]
  );
  const activeRound = getActiveRoundFromMatches(matches, maxRound);
  const [viewRound, setViewRound] = useState(activeRound);

  useEffect(() => {
    setViewRound((prev) => (prev < activeRound ? activeRound : prev));
  }, [activeRound]);

  const mobileRoundMatches = matches.filter((m) => m.round === viewRound);
  const roundOneByes = expandedMeta?.roundOneByes ?? [];

  return (
    <div className="manager-cup-bracket-breakout min-w-0">
      <BracketMobileRoundNav
        rounds={rounds}
        viewRound={viewRound}
        activeRound={activeRound}
        onViewRoundChange={setViewRound}
        getLabel={(round) => getRoundLabel(round, expanded)}
        getShortLabel={(round) => getShortLabel(round, maxRound)}
        activeClassName="border-accent-gold/55 bg-accent-gold/12 text-accent-gold shadow-[0_0_16px_rgba(251,191,36,0.12)]"
      />

      {expanded && viewRound === 1 && roundOneByes.length > 0 ? (
        <div className="mt-3 rounded-lg border border-pitch-600/40 bg-pitch-900/40 p-3 md:hidden">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-accent-gold">
            Bye to Round Two
          </p>
          <ul className="grid grid-cols-2 gap-1.5">
            {roundOneByes.map((club) => (
              <li
                key={club}
                className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-white"
              >
                <ClubDualSwatch club={club} size="xs" />
                <span className="truncate">{club}</span>
              </li>
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
        {expanded && roundOneByes.length > 0 ? (
          <div className="mb-4 rounded-lg border border-pitch-600/40 bg-pitch-900/35 p-3">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-accent-gold">
              Round One — Bye to Round Two
            </p>
            <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {roundOneByes.map((club) => (
                <li
                  key={club}
                  className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-white"
                >
                  <ClubDualSwatch club={club} size="xs" />
                  <span className="truncate">{club}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div
          className={`mx-auto flex items-stretch justify-center gap-3 ${
            expanded
              ? "min-w-[72rem] max-w-none px-2"
              : "w-full min-w-0 max-w-4xl gap-2"
          }`}
        >
          {rounds.map((round) => {
            const roundMatches = matches.filter((m) => m.round === round);
            return (
              <div
                key={round}
                className={`cup-bracket-column flex flex-col ${
                  expanded
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
}: {
  match: BracketMatch;
  userClub: string;
  byeTeams?: [string, string];
  expanded?: boolean;
  mobile?: boolean;
}) {
  if (match.status !== "complete") {
    const home = match.homeTeam;
    const away = match.awayTeam;
    if (home || away) {
      return (
        <div
          className={`cup-bracket-match rounded-lg border border-pitch-600/40 bg-pitch-900/40 ${
            match.isUserMatch ? "ring-1 ring-accent-gold/35" : ""
          } ${mobile ? "px-0 py-0.5 shadow-sm shadow-black/20" : "px-0 py-0"}`}
        >
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
        </div>
      );
    }
    return (
      <div
        className={`rounded-lg border border-pitch-600/30 bg-pitch-900/30 opacity-40 ${
          mobile ? "px-3 py-3" : "px-2 py-2"
        }`}
      >
        <p className={`${mobile ? "text-xs" : "text-[9px]"} text-gray-600`}>
          —
        </p>
      </div>
    );
  }

  return (
    <div
      className={`cup-bracket-match rounded-lg border px-0 py-0 ${
        match.isUserMatch
          ? "border-accent-gold/30 bg-accent-gold/5"
          : "border-pitch-600/30 bg-pitch-900/40"
      } ${mobile ? "py-0.5 shadow-sm shadow-black/20" : ""}`}
    >
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
    </div>
  );
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

  const teamTextColor = isUser
    ? undefined
    : loser
      ? "#6b7280"
      : getReadableTextColor(
          winner ? UI_SURFACES.bracketWinner : UI_SURFACES.bracketRow
        );

  return (
    <div
      className={`${mobile ? "px-3.5 py-2.5" : "px-2.5 py-1.5"} ${
        winner ? "bg-theme-primary/10" : loser ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <ClubDualSwatch club={team} size={mobile ? "sm" : "xs"} />
        <span
          className={`min-w-0 flex-1 break-words font-bold leading-snug ${
            mobile ? "text-[13px]" : "text-[11px]"
          } ${isUser ? "text-accent-gold" : "text-white"}`}
          style={
            !isUser && teamTextColor ? { color: teamTextColor } : undefined
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
          className={`mt-0.5 font-semibold uppercase tracking-wide text-accent-gold/90 ${
            mobile ? "pl-7 text-[9px]" : "pl-6 text-[7px]"
          }`}
        >
          Bye to Quarter Finals
        </p>
      )}
    </div>
  );
}
