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
    <div className="-mx-1 px-1 max-sm:overflow-x-auto sm:overflow-x-visible">
      <table className="w-full border-collapse text-left text-xs max-sm:min-w-[640px]">
        <thead>
          <tr className={`border-b border-pitch-700/60 ${TYPO.statLabel}`}>
            <th className="sticky left-0 z-10 bg-pitch-950/95 px-2 py-2.5 backdrop-blur-sm">
              Pos
            </th>
            <th className="min-w-[8rem] px-2 py-2.5">Team</th>
            <th className="px-2 py-2.5 text-center">P</th>
            <th className="px-2 py-2.5 text-center">W</th>
            <th className="px-2 py-2.5 text-center">L</th>
            <th className="hidden px-2 py-2.5 text-center sm:table-cell">PF</th>
            <th className="hidden px-2 py-2.5 text-center sm:table-cell">PA</th>
            <th className="hidden px-2 py-2.5 text-center md:table-cell">PD</th>
            <th className="px-2 py-2.5 text-center">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <LeagueTableRowView key={row.team} row={row} />
          ))}
        </tbody>
      </table>
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
          ? "border-l-2 border-l-accent-green bg-accent-green/[0.08]"
          : "hover:bg-pitch-900/40"
      }`}
    >
      <td
        className={`sticky left-0 z-10 px-2 py-2.5 font-display font-bold backdrop-blur-sm ${
          highlight
            ? "bg-accent-green/[0.12] text-accent-green"
            : "bg-pitch-950/95 text-gray-400"
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
          highlight ? "text-accent-green" : "text-white"
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
            ? "text-accent-green"
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
          highlight ? "text-accent-green" : "text-white"
        }`}
      >
        {row.leaguePoints}
      </td>
    </tr>
  );
});
