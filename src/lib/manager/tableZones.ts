/**
 * Registry-driven league-table zone labels.
 * Table UI must consume this — do not hardcode 1/2–5/11/12 in components.
 */
import type { ManagerCompetitionId } from "./types";
import {
  getAutoPromoteCount,
  getAutoRelegateCount,
  getDefaultClubsForLeague,
  getManagerLeague,
  leagueHasMillionPoundGame,
} from "./managerLeagues";

export type TableZoneKind =
  | "champion"
  | "playoffs"
  | "auto-promote"
  | "mpg"
  | "auto-relegate"
  | "wooden-spoon"
  | null;

export type TableZone = {
  kind: TableZoneKind;
  label: string;
};

export function getTableZone(
  competitionId: ManagerCompetitionId,
  position: number,
  tableSize?: number
): TableZone {
  const league = getManagerLeague(competitionId);
  const size = tableSize ?? getDefaultClubsForLeague(competitionId).length;
  const playoffMax = league.boardRules.playoffsMaxPosition;

  if (competitionId === "championship") {
    const autoPromote = getAutoPromoteCount("championship");
    if (position <= autoPromote && autoPromote > 0) {
      return { kind: "auto-promote", label: "Automatic Promotion" };
    }
    if (position > autoPromote && position <= playoffMax) {
      return { kind: "playoffs", label: "Championship play-offs" };
    }
    if (position === size) {
      return { kind: "wooden-spoon", label: "Wooden Spoon" };
    }
    return { kind: null, label: "" };
  }

  if (position === 1) {
    return { kind: "champion", label: "League leaders" };
  }
  if (position <= playoffMax) {
    return { kind: "playoffs", label: "Super League play-offs" };
  }
  if (leagueHasMillionPoundGame(competitionId) && position === size - 1) {
    return { kind: "mpg", label: "Million Pound Game" };
  }
  if (
    leagueHasMillionPoundGame(competitionId) &&
    position === size &&
    getAutoRelegateCount("super-league") > 0
  ) {
    return { kind: "auto-relegate", label: "Automatic Relegation" };
  }
  return { kind: null, label: "" };
}

export function getTableZoneLegend(
  competitionId: ManagerCompetitionId
): { kind: Exclude<TableZoneKind, null>; label: string }[] {
  if (competitionId === "championship") {
    return [
      { kind: "auto-promote", label: "1 Automatic Promotion" },
      { kind: "playoffs", label: "2–5 Play-offs" },
      { kind: "wooden-spoon", label: "Bottom Wooden Spoon" },
    ];
  }
  return [
    { kind: "playoffs", label: "1–6 Play-offs" },
    { kind: "mpg", label: "11 Million Pound Game" },
    { kind: "auto-relegate", label: "12 Automatic Relegation" },
  ];
}
