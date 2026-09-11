"use client";

import { memo, Fragment } from "react";
import type { LeagueTableRow } from "@/lib/game/league-table";
import { PLAYOFF_QUALIFIERS } from "@/lib/game/playoff-simulation";
import { TYPO } from "@/lib/ui/typography";
import { ClubNameLabel } from "./ClubNameLabel";

interface LeagueTableProps {
  rows: LeagueTableRow[];
  /** Last automatic play-off place (Super League top six). */
  playoffCutoff?: number;
}

function positionTone(position: number): string {
  if (position === 1) return "text-accent-gold";
  if (position === 2) return "text-pitch-200";
  if (position === 3) return "text-amber-600";
  return "text-pitch-400";
}

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
        <p className={TYPO.meta}>
          <span className="inline-block h-2 w-2 rounded-sm bg-theme-primary/70 align-middle" />{" "}
          Play-off places 1–{playoffCutoff}
        </p>
        {userRow ? (
          <p className={TYPO.meta}>
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

      <ol className="space-y-1.5">
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
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-pitch-500">
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
      className={`list-none rounded-xl border px-2.5 py-2.5 text-center sm:px-3 ${
        highlight
          ? "border-theme-primary/45 bg-theme-primary/10 shadow-[inset_3px_0_0_var(--theme-primary)]"
          : inPlayoffZone
            ? "border-theme-primary/20 bg-theme-primary/[0.06]"
            : "border-white/10 bg-[#0c1210]"
      }`}
    >
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-center gap-2 sm:gap-3">
        <span
          className={`font-display text-lg font-black tabular-nums leading-none sm:text-xl ${positionTone(
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
              <span className="shrink-0 rounded border border-theme-primary/40 bg-theme-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-theme-primary">
                You
              </span>
            ) : null}
          </div>
          <p className={`mt-1 ${TYPO.meta}`}>
            <span className="text-pitch-300">P{row.played}</span>
            <span className="text-pitch-600"> · </span>
            <span className="text-theme-primary">W{row.wins}</span>
            {row.draws > 0 ? (
              <>
                <span className="text-pitch-600"> · </span>
                <span className="text-pitch-300">D{row.draws}</span>
              </>
            ) : null}
            <span className="text-pitch-600"> · </span>
            <span className="text-red-400">L{row.losses}</span>
          </p>
        </div>

        <div className="shrink-0 text-center">
          <p
            className={`font-display text-xl font-black tabular-nums leading-none sm:text-2xl ${
              highlight ? "text-theme-primary" : "text-white"
            }`}
          >
            {row.leaguePoints}
          </p>
          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-pitch-500">
            Pts
          </p>
        </div>
      </div>
    </li>
  );
});
