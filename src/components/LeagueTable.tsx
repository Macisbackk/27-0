"use client";

import { memo } from "react";
import type { LeagueTableRow } from "@/lib/game/league-table";
import { TYPO } from "@/lib/ui/typography";
import { ClubNameLabel } from "./ClubNameLabel";

interface LeagueTableProps {
  rows: LeagueTableRow[];
}

export const LeagueTable = memo(function LeagueTable({ rows }: LeagueTableProps) {
  return (
    <div className="w-full min-w-0 max-w-full">
      <ul className="space-y-2 sm:hidden">
        {rows.map((row) => (
          <li
            key={row.team}
            className="flex min-h-[44px] items-center gap-2 border-b border-white/5 px-0 py-2.5"
          >
            <span className="w-6 shrink-0 font-mono text-sm text-pitch-400">
              {row.position}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                row.isUserTeam ? "font-semibold text-theme-primary" : "text-pitch-200"
              }`}
            >
              {row.team}
            </span>
            <span className="shrink-0 text-right text-[11px] leading-tight text-pitch-400">
              P {row.played} · W {row.wins} · PTS {row.leaguePoints}
            </span>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] sm:block">
      <table className="w-full min-w-0 border-collapse text-left text-[11px] sm:text-xs">
        <thead>
          <tr className={`border-b border-pitch-700/60 ${TYPO.statLabel}`}>
            <th className="sticky left-0 z-10 bg-pitch-950 px-1.5 py-2 sm:px-2 sm:py-2.5">
              Pos
            </th>
            <th className="min-w-0 max-w-[9rem] truncate px-1.5 py-2 sm:min-w-[8rem] sm:max-w-none sm:px-2 sm:py-2.5">
              Team
            </th>
            <th className="px-1.5 py-2 text-center sm:px-2 sm:py-2.5">P</th>
            <th className="px-1.5 py-2 text-center sm:px-2 sm:py-2.5">W</th>
            <th className="px-1.5 py-2 text-center sm:px-2 sm:py-2.5">L</th>
            <th className="hidden px-2 py-2.5 text-center sm:table-cell">PF</th>
            <th className="hidden px-2 py-2.5 text-center sm:table-cell">PA</th>
            <th className="hidden px-2 py-2.5 text-center md:table-cell">PD</th>
            <th className="px-1.5 py-2 text-center sm:px-2 sm:py-2.5">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <LeagueTableRowView key={row.team} row={row} />
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
});

const LeagueTableRowView = memo(function LeagueTableRowView({
  row,
}: {
  row: LeagueTableRow;
}) {
  const highlight = row.isUserTeam;

  return (
    <tr
      className={`border-b border-pitch-800/50 transition ${
        highlight
          ? "border-l-2 border-l-theme-primary bg-theme-primary/10"
          : "hover:bg-pitch-900/40"
      }`}
    >
      <td
        className={`sticky left-0 z-10 px-2 py-2.5 font-display font-bold ${
          highlight
            ? "bg-theme-primary/10 text-theme-primary"
            : "bg-pitch-950 text-gray-400"
        }`}
      >
        {row.position}
      </td>
      <td className="max-w-[10rem] px-2 py-2.5 sm:max-w-none">
        <ClubNameLabel
          club={row.team}
          variant="inline"
          compact
          className="max-w-full truncate"
        />
      </td>
      <td className="px-2 py-2.5 text-center text-gray-400">{row.played}</td>
      <td
        className={`px-2 py-2.5 text-center font-semibold ${
          highlight ? "text-theme-primary" : "text-white"
        }`}
      >
        {row.wins}
      </td>
      <td className="px-2 py-2.5 text-center text-gray-400">{row.losses}</td>
      <td className="hidden px-2 py-2.5 text-center text-gray-300 sm:table-cell">
        {row.pointsFor}
      </td>
      <td className="hidden px-2 py-2.5 text-center text-gray-300 sm:table-cell">
        {row.pointsAgainst}
      </td>
      <td
        className={`hidden px-2 py-2.5 text-center font-medium md:table-cell ${
          row.pointsDifference > 0
            ? "text-theme-primary"
            : row.pointsDifference < 0
              ? "text-red-400"
              : "text-gray-400"
        }`}
      >
        {row.pointsDifference > 0 ? "+" : ""}
        {row.pointsDifference}
      </td>
      <td
        className={`px-2 py-2.5 text-center font-display font-bold ${
          highlight ? "text-theme-primary" : "text-white"
        }`}
      >
        {row.leaguePoints}
      </td>
    </tr>
  );
});
