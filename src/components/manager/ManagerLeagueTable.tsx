"use client";

import { useState } from "react";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getClubIndicatorColor } from "@/lib/clubs";
import type { ManagerCareer } from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function ManagerLeagueTable({
  career,
  title = "League Table",
  subtitle,
  onViewClub,
  defaultExpanded = false,
}: {
  career: ManagerCareer;
  title?: string;
  subtitle?: string;
  onViewClub?: (club: string) => void;
  /** When true, show every club without compact top-five trimming. */
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rows = career.leagueTable;
  if (rows.length === 0) return null;

  const userRow = rows.find((r) => r.isUserTeam);
  const showCompact =
    !expanded &&
    !defaultExpanded &&
    rows.length > 8 &&
    userRow &&
    userRow.position > 5;
  const displayRows = showCompact
    ? [...rows.slice(0, 5), ...(userRow.position > 5 ? [userRow] : [])]
    : rows;

  return (
    <div className={`${CARD.elevated} ${SPACING.cardPadding}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={TYPO.sectionLabel}>{title}</p>
        {!defaultExpanded && rows.length > 6 && (
          <button
            type="button"
            onClick={() => {
              playUiClick();
              setExpanded((e) => !e);
            }}
            className="text-xs text-theme-primary hover:underline"
          >
            {expanded ? "Show less" : "Show full table"}
          </button>
        )}
      </div>
      {subtitle && (
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>{subtitle}</p>
      )}
      {userRow && (
        <p className={`mt-1 ${TYPO.cardTitle}`}>
          <span
            className={
              userRow.position <= 3
                ? "text-accent-gold"
                : userRow.position <= 6
                  ? "text-theme-primary"
                  : userRow.position >= 12
                    ? "text-red-300"
                    : "text-white"
            }
          >
            {ordinal(userRow.position)}
          </span>
          <span className="text-pitch-400"> · </span>
          <span className="text-theme-primary">{career.club}</span>
        </p>
      )}
      <ul className={`mt-3 space-y-2 sm:hidden ${SPACING.stackSm}`}>
        {displayRows.map((row) => {
          const indicatorColor = getClubIndicatorColor(row.team);
          const inner = (
            <>
              <span className="font-mono text-sm text-pitch-400">{row.position}</span>
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: indicatorColor }}
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  row.isUserTeam ? "font-semibold text-theme-primary" : "text-pitch-200"
                }`}
              >
                {row.team}
              </span>
              <span className="text-xs text-pitch-400">
                {row.wins}W-{row.losses}L
              </span>
              <span className="font-semibold text-accent-gold">{row.leaguePoints}pts</span>
            </>
          );
          return (
            <li
              key={row.team}
              className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 ${
                row.isUserTeam
                  ? "border-theme-primary/35 bg-theme-primary/10"
                  : "border-pitch-700/50 bg-pitch-950/40"
              }`}
            >
              {onViewClub ? (
                <button
                  type="button"
                  onClick={() => {
                    playUiClick();
                    onViewClub(row.team);
                  }}
                  className="flex w-full items-center gap-2 text-left"
                >
                  {inner}
                </button>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
      <div className="-mx-1 mt-3 hidden overflow-x-auto px-1 sm:block">
        <table className="w-full text-left text-sm">
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
            {displayRows.map((row) => {
              const indicatorColor = getClubIndicatorColor(row.team);
              return (
                <tr
                  key={row.team}
                  className={`border-b border-pitch-800/40 ${
                    row.isUserTeam ? "bg-theme-primary/10" : ""
                  }`}
                >
                  <td className={`${SPACING.tableCell} font-mono text-pitch-400`}>
                    {row.position}
                  </td>
                  <td className={SPACING.tableCell}>
                    {onViewClub ? (
                      <button
                        type="button"
                        onClick={() => {
                          playUiClick();
                          onViewClub(row.team);
                        }}
                        className="flex w-full items-center gap-2 text-left transition hover:text-theme-primary"
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: indicatorColor }}
                        />
                        <span
                          className={
                            row.isUserTeam
                              ? "font-semibold text-theme-primary"
                              : "text-pitch-200"
                          }
                        >
                          {row.team}
                        </span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: indicatorColor }}
                        />
                        <span
                          className={
                            row.isUserTeam
                              ? "font-semibold text-theme-primary"
                              : "text-pitch-200"
                          }
                        >
                          {row.team}
                        </span>
                      </span>
                    )}
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
                  <td className={`${SPACING.tableCell} text-center font-semibold text-accent-gold`}>
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
