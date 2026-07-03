"use client";

import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { getClubIndicatorColor } from "@/lib/clubs";

interface ManagerTableProps {
  career: ManagerCareer;
}

export function ManagerTable({ career }: ManagerTableProps) {
  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <h1 className={TYPO.pageTitle}>League Table</h1>

      <div className={`${CARD.base} -mx-1 overflow-x-auto px-1`}>
        <table className="w-full max-sm:min-w-[320px] text-left text-sm">
          <thead>
            <tr className="border-b border-pitch-700/50 text-pitch-400">
              <th className={SPACING.tableCell}>#</th>
              <th className={SPACING.tableCell}>Club</th>
              <th className={`${SPACING.tableCell} text-center`}>P</th>
              <th className={`${SPACING.tableCell} text-center`}>W</th>
              <th className={`${SPACING.tableCell} text-center`}>L</th>
              <th className={`hidden sm:table-cell ${SPACING.tableCell} text-center`}>
                PF
              </th>
              <th className={`hidden sm:table-cell ${SPACING.tableCell} text-center`}>
                PA
              </th>
              <th className={`hidden md:table-cell ${SPACING.tableCell} text-center`}>
                +/-
              </th>
              <th className={`${SPACING.tableCell} text-center`}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {career.leagueTable.map((row) => {
              const indicatorColor = getClubIndicatorColor(row.team);
              return (
                <tr
                  key={row.team}
                  className={`border-b border-pitch-800/40 ${
                    row.isUserTeam ? "bg-theme-primary/5" : ""
                  }`}
                >
                  <td className={`${SPACING.tableCell} font-mono text-pitch-400`}>
                    {row.position}
                  </td>
                  <td className={SPACING.tableCell}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: indicatorColor }}
                      />
                      <span
                        className={
                          row.isUserTeam ? "font-semibold text-theme-primary" : ""
                        }
                      >
                        {row.team}
                      </span>
                    </span>
                  </td>
                  <td className={`${SPACING.tableCell} text-center`}>{row.played}</td>
                  <td className={`${SPACING.tableCell} text-center`}>{row.wins}</td>
                  <td className={`${SPACING.tableCell} text-center`}>{row.losses}</td>
                  <td className={`hidden sm:table-cell ${SPACING.tableCell} text-center`}>
                    {row.pointsFor}
                  </td>
                  <td className={`hidden sm:table-cell ${SPACING.tableCell} text-center`}>
                    {row.pointsAgainst}
                  </td>
                  <td className={`hidden md:table-cell ${SPACING.tableCell} text-center`}>
                    {row.pointsDifference > 0 ? "+" : ""}
                    {row.pointsDifference}
                  </td>
                  <td
                    className={`${SPACING.tableCell} text-center font-semibold text-accent-gold`}
                  >
                    {row.leaguePoints}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
