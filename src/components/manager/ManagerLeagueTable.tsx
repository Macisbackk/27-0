"use client";

import { useState } from "react";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { getClubIndicatorColor } from "@/lib/clubs";
import type { ManagerCareer } from "@/lib/manager/types";
import { isUserInChampionship } from "@/lib/manager/leagueMembership";
import { playUiClick } from "@/lib/sound";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

type TableZone =
  | "playoffs"
  | "auto-promote"
  | "champ-playoffs"
  | "mpg"
  | "auto-relegate"
  | "wooden-spoon"
  | null;

function getTableZone(
  position: number,
  championshipTable: boolean
): TableZone {
  if (championshipTable) {
    if (position === 1) return "auto-promote";
    if (position >= 2 && position <= 5) return "champ-playoffs";
    if (position >= 18) return "wooden-spoon";
    return null;
  }
  if (position <= 6) return "playoffs";
  if (position === 11) return "mpg";
  if (position === 12) return "auto-relegate";
  return null;
}

function zoneRowClass(zone: TableZone, isUser: boolean): string {
  if (isUser) return "border-theme-primary/35 bg-theme-primary/10";
  switch (zone) {
    case "playoffs":
    case "champ-playoffs":
      return "border-amber-500/25 bg-amber-500/5";
    case "auto-promote":
      return "border-theme-primary/30 bg-theme-primary/8";
    case "mpg":
      return "border-accent-gold/35 bg-accent-gold/8";
    case "auto-relegate":
      return "border-red-400/30 bg-red-500/8";
    case "wooden-spoon":
      return "border-pitch-600/50 bg-pitch-950/50";
    default:
      return "border-pitch-700/50 bg-pitch-950/40";
  }
}

function zoneRowClassDesktop(zone: TableZone, isUser: boolean): string {
  if (isUser) return "bg-theme-primary/10";
  switch (zone) {
    case "playoffs":
    case "champ-playoffs":
      return "bg-amber-500/5";
    case "auto-promote":
      return "bg-theme-primary/5";
    case "mpg":
      return "bg-accent-gold/8";
    case "auto-relegate":
      return "bg-red-500/8";
    default:
      return "";
  }
}

export function ManagerLeagueTable({
  career,
  title = "League Table",
  subtitle,
  onViewClub,
  defaultExpanded = false,
  rows: rowsProp,
  showDraws = true,
  competitionId,
}: {
  career: ManagerCareer;
  title?: string;
  subtitle?: string;
  onViewClub?: (club: string) => void;
  /** When true, show every club without compact top-five trimming. */
  defaultExpanded?: boolean;
  /** Override standings (e.g. Championship). Defaults to Super League table. */
  rows?: ManagerCareer["leagueTable"];
  showDraws?: boolean;
  /** When set, drives promotion/relegation zone legend (otherwise inferred from career). */
  competitionId?: "super-league" | "championship";
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rows = rowsProp ?? career.leagueTable;
  if (rows.length === 0) return null;

  const championshipTable =
    competitionId === "championship" ||
    (competitionId == null && isUserInChampionship(career));
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
              championshipTable
                ? userRow.position === 1
                  ? "text-theme-primary"
                  : userRow.position <= 5
                    ? "text-amber-300"
                    : userRow.position >= 18
                      ? "text-red-300"
                      : "text-white"
                : userRow.position === 1
                  ? "text-accent-gold"
                  : userRow.position <= 6
                    ? "text-amber-300"
                    : userRow.position === 11
                      ? "text-accent-gold"
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
          const zone = getTableZone(row.position, championshipTable);
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
                {showDraws
                  ? `${row.wins}W-${row.draws ?? 0}D-${row.losses}L`
                  : `${row.wins}W-${row.losses}L`}
              </span>
              <span className="font-semibold text-accent-gold">{row.leaguePoints}pts</span>
            </>
          );
          return (
            <li
              key={row.team}
              className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 ${zoneRowClass(
                zone,
                Boolean(row.isUserTeam)
              )}`}
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
            {displayRows.map((row) => {
              const indicatorColor = getClubIndicatorColor(row.team);
              const draws =
                row.draws ?? Math.max(0, row.played - row.wins - row.losses);
              const zone = getTableZone(row.position, championshipTable);
              return (
                <tr
                  key={row.team}
                  className={`border-b border-pitch-800/40 ${zoneRowClassDesktop(
                    zone,
                    Boolean(row.isUserTeam)
                  )}`}
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
                  <td className={`${SPACING.tableCell} text-center font-semibold text-accent-gold`}>
                    {row.leaguePoints}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={`mt-3 flex flex-wrap gap-x-3 gap-y-1 ${TYPO.meta} text-pitch-500`}>
        {championshipTable ? (
          <>
            <span className="text-theme-primary">1 Auto promote</span>
            <span className="text-amber-300">2–5 Play-offs</span>
            <span className="text-accent-gold">Winner → Million Pound Game</span>
          </>
        ) : (
          <>
            <span className="text-amber-300">1–6 Play-offs</span>
            <span className="text-accent-gold">11 Million Pound Game</span>
            <span className="text-red-300">12 Auto relegate</span>
          </>
        )}
      </div>
    </div>
  );
}
