"use client";

import { useEffect, useState } from "react";
import type { BracketMatch } from "@/lib/game/challenge-cup-bracket";
import { getCupRoundLabel } from "@/lib/game/challenge-cup-bracket";
import { getReadableTextColor } from "@/lib/ui/contrast";
import { UI_SURFACES } from "@/lib/ui/surfaces";
import { BracketMobileRoundNav } from "./BracketMobileRoundNav";
import { ClubDualSwatch } from "./ClubDualSwatch";

interface BracketRecapProps {
  matches: BracketMatch[];
  userClub: string;
  byeTeams?: [string, string];
}

const ROUNDS = [1, 2, 3, 4] as const;

const CUP_ROUND_SHORT: Record<number, string> = {
  1: "R16",
  2: "QF",
  3: "SF",
  4: "F",
};

function getActiveRoundFromMatches(matches: BracketMatch[]): number {
  for (let round = 1; round <= 4; round++) {
    if (
      matches
        .filter((m) => m.round === round)
        .some((match) => match.status === "ready")
    ) {
      return round;
    }
  }
  return 4;
}

function CupRoundTitle({
  round,
  activeRound,
}: {
  round: number;
  activeRound: number;
}) {
  const isFinal = round === 4;
  const isLive = round === activeRound;

  return (
    <div
      className={`playoff-bracket-round-title mb-3 ${
        isFinal ? "playoff-bracket-round-title--final" : ""
      } ${isLive ? "playoff-bracket-round-title--live" : ""}`}
    >
      <span className="playoff-bracket-round-title__short">
        {CUP_ROUND_SHORT[round] ?? round}
      </span>
      <span className="playoff-bracket-round-title__label">
        {getCupRoundLabel(round)}
      </span>
    </div>
  );
}

export function BracketRecap({
  matches,
  userClub,
  byeTeams,
}: BracketRecapProps) {
  const activeRound = getActiveRoundFromMatches(matches);
  const [viewRound, setViewRound] = useState(activeRound);

  useEffect(() => {
    setViewRound((prev) => (prev < activeRound ? activeRound : prev));
  }, [activeRound]);

  const mobileRoundMatches = matches.filter((m) => m.round === viewRound);

  return (
    <div className="min-w-0">
      <BracketMobileRoundNav
        rounds={ROUNDS}
        viewRound={viewRound}
        activeRound={activeRound}
        onViewRoundChange={setViewRound}
        getLabel={getCupRoundLabel}
        getShortLabel={(round) => CUP_ROUND_SHORT[round] ?? getCupRoundLabel(round)}
        activeClassName="border-accent-gold/55 bg-accent-gold/12 text-accent-gold shadow-[0_0_16px_rgba(251,191,36,0.12)]"
      />

      <div className="mt-4 md:hidden">
        <CupRoundTitle round={viewRound} activeRound={activeRound} />
        <div className="space-y-3">
          {mobileRoundMatches.map((match) => (
            <RecapMatch
              key={match.id}
              match={match}
              userClub={userClub}
              byeTeams={byeTeams}
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

      <div className="hidden overflow-x-auto pb-2 md:block md:overflow-x-visible md:pb-0">
        <div className="mx-auto flex w-full min-w-0 max-w-4xl items-stretch justify-between gap-2">
          {ROUNDS.map((round) => {
            const roundMatches = matches.filter((m) => m.round === round);
            return (
              <div key={round} className="flex min-w-0 flex-1 flex-col">
                <p className="mb-2 text-center font-display text-[9px] font-bold uppercase tracking-wider text-gray-500">
                  {getCupRoundLabel(round)}
                </p>
                <div className="flex flex-1 flex-col justify-around gap-2">
                  {roundMatches.map((match) => (
                    <RecapMatch
                      key={match.id}
                      match={match}
                      userClub={userClub}
                      byeTeams={byeTeams}
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
  mobile = false,
}: {
  match: BracketMatch;
  userClub: string;
  byeTeams?: [string, string];
  mobile?: boolean;
}) {
  if (match.status !== "complete") {
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
      }`}
    >
      <RecapTeam
        team={match.homeTeam}
        score={match.homeScore}
        winner={match.winner === match.homeTeam}
        loser={match.loser === match.homeTeam}
        userClub={userClub}
        showByeAdvance={
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
  if (!team) return null;
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
      className={`${mobile ? "px-3 py-2" : "px-2 py-1"} ${
        winner ? "bg-accent-green/10" : loser ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <ClubDualSwatch club={team} size="xs" />
        <span
          className={`min-w-0 flex-1 break-words font-bold leading-snug ${
            mobile ? "text-xs" : "text-[9px]"
          } ${isUser ? "text-accent-gold" : ""}`}
          style={teamTextColor ? { color: teamTextColor } : undefined}
        >
          {team}
        </span>
        {score !== null && (
          <span
            className={`font-bold tabular-nums ${
              mobile ? "text-sm" : "text-[10px]"
            } ${winner ? "text-accent-green" : "text-gray-500"}`}
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
