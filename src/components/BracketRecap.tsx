"use client";

import type { BracketMatch } from "@/lib/game/challenge-cup-bracket";
import { getCupRoundLabel } from "@/lib/game/challenge-cup-bracket";
import { getReadableTextColor } from "@/lib/ui/contrast";
import { UI_SURFACES } from "@/lib/ui/surfaces";
import { ClubDualSwatch } from "./ClubDualSwatch";

interface BracketRecapProps {
  matches: BracketMatch[];
  userClub: string;
  byeTeams?: [string, string];
}

const ROUNDS = [1, 2, 3, 4] as const;

export function BracketRecap({
  matches,
  userClub,
  byeTeams,
}: BracketRecapProps) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="mx-auto flex min-w-[640px] max-w-4xl items-stretch justify-between gap-2">
        {ROUNDS.map((round) => {
          const roundMatches = matches.filter((m) => m.round === round);
          return (
            <div key={round} className="flex flex-1 flex-col">
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
  );
}

function RecapMatch({
  match,
  userClub,
  byeTeams,
}: {
  match: BracketMatch;
  userClub: string;
  byeTeams?: [string, string];
}) {
  if (match.status !== "complete") {
    return (
      <div className="rounded-lg border border-pitch-600/30 bg-pitch-900/30 px-2 py-2 opacity-40">
        <p className="text-[9px] text-gray-600">—</p>
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
          match.status !== "complete" &&
          match.homeTeam !== null &&
          byeTeams.includes(match.homeTeam)
        }
      />
      <div className="border-t border-pitch-600/20" />
      <RecapTeam
        team={match.awayTeam}
        score={match.awayScore}
        winner={match.winner === match.awayTeam}
        loser={match.loser === match.awayTeam}
        userClub={userClub}
        showByeAdvance={
          !!byeTeams &&
          match.round === 2 &&
          match.status !== "complete" &&
          match.awayTeam !== null &&
          byeTeams.includes(match.awayTeam)
        }
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
}: {
  team: string | null;
  score: number | null;
  winner: boolean;
  loser: boolean;
  userClub: string;
  showByeAdvance?: boolean;
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
      className={`px-2 py-1 ${
        winner ? "bg-accent-green/10" : loser ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <ClubDualSwatch club={team} size="xs" />
        <span
          className={`min-w-0 flex-1 break-words text-[9px] font-bold leading-snug ${
            isUser ? "text-accent-gold" : ""
          }`}
          style={teamTextColor ? { color: teamTextColor } : undefined}
        >
          {team}
        </span>
        {score !== null && (
          <span
            className={`text-[10px] font-bold ${
              winner ? "text-accent-green" : "text-gray-500"
            }`}
          >
            {score}
          </span>
        )}
      </div>
      {showByeAdvance && (
        <p className="mt-0.5 pl-6 text-[7px] font-semibold uppercase tracking-wide text-accent-gold/90">
          Advanced to Quarter Finals
        </p>
      )}
    </div>
  );
}
