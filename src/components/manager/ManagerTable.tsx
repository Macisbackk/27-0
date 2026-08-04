"use client";

import { useState } from "react";
import { ManagerPage, ManagerSection } from "@/components/manager/manager-ui";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer, ManagerLeagueRow } from "@/lib/manager/types";
import { getClubIndicatorColor } from "@/lib/clubs";
import { ensureChampionshipSystems } from "@/lib/manager/championship/ensureChampionship";

type TableCompetition = "super-league" | "championship";

interface ManagerTableProps {
  career: ManagerCareer;
}

function LeagueTableGrid({
  rows,
  showDraws,
}: {
  rows: ManagerLeagueRow[];
  showDraws?: boolean;
}) {
  return (
    <div className={`${CARD.base} -mx-1 overflow-x-auto px-1`}>
      <table className="w-full max-sm:min-w-[320px] text-left text-sm">
        <thead>
          <tr className="border-b border-pitch-700/50 text-pitch-400">
            <th className={SPACING.tableCell}>#</th>
            <th className={SPACING.tableCell}>Club</th>
            <th className={`${SPACING.tableCell} text-center`}>P</th>
            <th className={`${SPACING.tableCell} text-center`}>W</th>
            {showDraws ? (
              <th className={`${SPACING.tableCell} text-center`}>D</th>
            ) : null}
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
          {rows.map((row) => {
            const indicatorColor = getClubIndicatorColor(row.team);
            const draws = row.draws ?? Math.max(
              0,
              row.played - row.wins - row.losses
            );
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
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: indicatorColor }}
                      aria-hidden
                    />
                    <span className="truncate font-medium text-white">
                      {row.team}
                    </span>
                  </span>
                </td>
                <td className={`${SPACING.tableCell} text-center`}>{row.played}</td>
                <td className={`${SPACING.tableCell} text-center`}>{row.wins}</td>
                {showDraws ? (
                  <td className={`${SPACING.tableCell} text-center`}>{draws}</td>
                ) : null}
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
  );
}

export function ManagerTable({ career }: ManagerTableProps) {
  const [competition, setCompetition] =
    useState<TableCompetition>("super-league");
  const [menuOpen, setMenuOpen] = useState(false);

  const withChamp = ensureChampionshipSystems(career);
  const title =
    competition === "super-league" ? "Super League" : "Championship";
  const rows =
    competition === "super-league"
      ? career.leagueTable
      : withChamp.championshipCompetition?.standings ?? [];

  return (
    <ManagerPage>
      <ManagerSection>
        <div className="relative mb-3">
          <button
            type="button"
            className={`${TYPO.pageTitle} btn-press inline-flex items-center gap-2 text-left`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {title}
            <span className="text-sm font-normal text-pitch-400" aria-hidden>
              ▾
            </span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute z-20 mt-1 min-w-[12rem] rounded-lg border border-pitch-600/70 bg-pitch-950 p-1 shadow-xl"
            >
              {(
                [
                  ["super-league", "Super League"],
                  ["championship", "Championship"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  className={`btn-press block w-full rounded-md px-3 py-2 text-left text-sm ${
                    competition === id
                      ? "bg-theme-primary/15 text-theme-primary"
                      : "text-white hover:bg-pitch-800"
                  }`}
                  onClick={() => {
                    setCompetition(id);
                    setMenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <p className={`${TYPO.bodySm} mb-3 text-pitch-400`}>
          {competition === "super-league"
            ? `Season ${career.seasonYear} Super League standings`
            : `Season ${career.seasonYear} Championship standings`}
        </p>
        <LeagueTableGrid rows={rows} showDraws />
      </ManagerSection>
    </ManagerPage>
  );
}
