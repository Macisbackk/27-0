"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { getClubByName } from "@/lib/clubs";

interface ManagerTableProps {
  career: ManagerCareer;
  onBack: () => void;
}

export function ManagerTable({ career, onBack }: ManagerTableProps) {
  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div className="flex items-center justify-between gap-3">
        <h1 className={TYPO.pageTitle}>League Table</h1>
        <GameButton variant="secondary" fullWidth={false} size="sm" onClick={onBack}>
          Hub
        </GameButton>
      </div>

      <div className={`${CARD.base} overflow-x-auto`}>
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-pitch-700/50 text-pitch-400">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Club</th>
              <th className="px-3 py-2 text-center">P</th>
              <th className="px-3 py-2 text-center">W</th>
              <th className="px-3 py-2 text-center">L</th>
              <th className="px-3 py-2 text-center">PF</th>
              <th className="px-3 py-2 text-center">PA</th>
              <th className="px-3 py-2 text-center">+/-</th>
              <th className="px-3 py-2 text-center">Pts</th>
            </tr>
          </thead>
          <tbody>
            {career.leagueTable.map((row) => {
              const club = getClubByName(row.team);
              return (
                <tr
                  key={row.team}
                  className={`border-b border-pitch-800/40 ${
                    row.isUserTeam ? "bg-theme-primary/5" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-pitch-400">
                    {row.position}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: club?.primaryColor }}
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
                  <td className="px-3 py-2 text-center">{row.played}</td>
                  <td className="px-3 py-2 text-center">{row.wins}</td>
                  <td className="px-3 py-2 text-center">{row.losses}</td>
                  <td className="px-3 py-2 text-center">{row.pointsFor}</td>
                  <td className="px-3 py-2 text-center">{row.pointsAgainst}</td>
                  <td className="px-3 py-2 text-center">
                    {row.pointsDifference > 0 ? "+" : ""}
                    {row.pointsDifference}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-accent-gold">
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
