"use client";

import { memo, Fragment } from "react";
import type { LeagueTableRow } from "@/lib/game/league-table";
import { PLAYOFF_QUALIFIERS } from "@/lib/game/playoff-simulation";
import { ClubNameLabel } from "./ClubNameLabel";

interface LeagueTableProps {
  rows: LeagueTableRow[];
  /** Last automatic play-off place (Super League top six). */
  playoffCutoff?: number;
}

function positionTone(position: number): string {
  if (position === 1) return "text-accent-gold";
  if (position === 2) return "text-gray-300";
  if (position === 3) return "text-amber-600";
  return "text-[color:var(--fl-muted)]";
}

const META = "text-xs leading-snug text-[color:var(--fl-muted)]";

export const LeagueTable = memo(function LeagueTable({
  rows,
  playoffCutoff = PLAYOFF_QUALIFIERS,
}: LeagueTableProps) {
  const userRow = rows.find((row) => row.isUserTeam);
  const userInPlayoffs = Boolean(
    userRow && userRow.position <= playoffCutoff
  );

  return (
    <div className="w-full min-w-0 max-w-full text-center">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <p className={META}>
          <span className="inline-block h-2 w-2 rounded-full bg-pitch-600 align-middle" />{" "}
          Play-off places 1–{playoffCutoff}
        </p>
        {userRow ? (
          <p className={META}>
            You finished{" "}
            <span className="font-semibold text-theme-primary">
              {userRow.position}
              {userRow.position === 1
                ? "st"
                : userRow.position === 2
                  ? "nd"
                  : userRow.position === 3
                    ? "rd"
                    : "th"}
            </span>
            {userInPlayoffs ? " · qualified" : ""}
          </p>
        ) : null}
      </div>

      <ol className="space-y-1">
        {rows.map((row) => {
          const showCut =
            row.position === playoffCutoff + 1 && rows.length > playoffCutoff;
          return (
            <Fragment key={row.team}>
              {showCut ? (
                <li
                  className="flex list-none items-center gap-3 py-1.5"
                  aria-hidden
                >
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="shrink-0 text-xs font-semibold text-[color:var(--fl-muted)]">
                    Play-off cut
                  </span>
                  <span className="h-px flex-1 bg-white/10" />
                </li>
              ) : null}
              <LeagueStandingRow
                row={row}
                inPlayoffZone={row.position <= playoffCutoff}
              />
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
});

const LeagueStandingRow = memo(function LeagueStandingRow({
  row,
  inPlayoffZone,
}: {
  row: LeagueTableRow;
  inPlayoffZone: boolean;
}) {
  const highlight = row.isUserTeam;

  return (
    <li
      className={`list-none rounded-[14px] px-2.5 py-2 text-center sm:px-3 ${
        highlight
          ? "bg-theme-primary/10 ring-1 ring-inset ring-theme-primary/40"
          : inPlayoffZone
            ? "bg-pitch-800"
            : "bg-pitch-950/60"
      }`}
    >
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-center gap-2 sm:gap-3">
        <span
          className={`fl-number text-lg tabular-nums sm:text-xl ${positionTone(
            row.position
          )} ${highlight ? "!text-theme-primary" : ""}`}
        >
          {row.position}
        </span>

        <div className="min-w-0 text-center">
          <div className="flex min-w-0 items-center justify-center gap-2">
            <ClubNameLabel
              club={row.team}
              variant="row"
              compact
              showAccent={false}
              className="min-w-0 truncate"
            />
            {highlight ? (
              <span className="shrink-0 rounded-full bg-theme-primary/15 px-2 py-0.5 text-[11px] font-semibold text-theme-primary">
                You
              </span>
            ) : null}
          </div>
          <p className={`mt-0.5 ${META}`}>
            <span className="text-gray-300">P{row.played}</span>
            <span className="text-white/20"> · </span>
            <span className="text-theme-primary">W{row.wins}</span>
            {row.draws > 0 ? (
              <>
                <span className="text-white/20"> · </span>
                <span className="text-gray-300">D{row.draws}</span>
              </>
            ) : null}
            <span className="text-white/20"> · </span>
            <span className="text-red-400">L{row.losses}</span>
          </p>
        </div>

        <div className="shrink-0 text-center">
          <p
            className={`fl-number text-xl tabular-nums sm:text-2xl ${
              highlight ? "text-theme-primary" : "text-white"
            }`}
          >
            {row.leaguePoints}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--fl-muted)]">
            Pts
          </p>
        </div>
      </div>
    </li>
  );
});
