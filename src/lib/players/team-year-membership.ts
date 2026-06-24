import clubCareerSpans from "../../../data/club-career-spans.json";
import type { Player } from "../types";
import { resolveDisplayClub } from "../clubs/super-league-display";

const EXTRA_CLUB_SPANS = clubCareerSpans as Record<string, string[]>;

const RLP_CLUB_ALIASES: Record<string, string> = {
  Leigh: "Leigh Leopards",
  "Leigh Centurions": "Leigh Leopards",
  Salford: "Salford Red Devils",
  York: "York Knights",
  Huddersfield: "Huddersfield Giants",
  Wakefield: "Wakefield Trinity",
  Wigan: "Wigan Warriors",
  Warrington: "Warrington Wolves",
  Leeds: "Leeds Rhinos",
  Bradford: "Bradford Bulls",
  Castleford: "Castleford Tigers",
  Catalans: "Catalans Dragons",
  London: "London Broncos",
  "Hull KR": "Hull KR",
  "St Helens": "St Helens",
  "Hull FC": "Hull FC",
};

function parseYearsActiveRange(yearsActive: string): {
  start: number;
  end: number | null;
} {
  const normalized = yearsActive.replace(/-/g, "–");
  const years = [...normalized.matchAll(/(\d{4})/g)].map((m) =>
    Number.parseInt(m[1], 10)
  );
  if (years.length === 0) {
    return { start: 0, end: null };
  }
  const start = years[0];
  if (/present/i.test(normalized)) {
    return { start, end: new Date().getFullYear() };
  }
  const end = years.length > 1 ? years[years.length - 1] : start;
  return { start, end };
}

function isPlayerActiveInYear(player: Player, year: number): boolean {
  const { start, end } = parseYearsActiveRange(player.yearsActive);
  if (start === 0) return false;
  if (year < start) return false;
  if (end !== null && year > end) return false;
  return true;
}

function parseYearFromId(id: string): number | undefined {
  const match = id.match(/-(\d{4})$/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function playerClubMatchesTeam(player: Player, team: string): boolean {
  const displayClub = resolveDisplayClub(player.id, player.club, player.name);
  if (displayClub === team) return true;
  if (player.baseClub === team) return true;
  return false;
}

/** True when a player record is plausibly tied to an exact club/year (roster membership gate). */
export function playerBelongsToTeamYear(
  player: Player,
  team: string,
  year: number | string
): boolean {
  const y = typeof year === "string" ? Number.parseInt(year, 10) : year;
  if (!Number.isFinite(y)) return false;

  const currentYear = new Date().getFullYear();

  if (player.category === "current" && y < currentYear) {
    return false;
  }

  const idYear = parseYearFromId(player.id);
  const hasExplicitYear =
    (player.cardYear !== undefined && player.cardYear === y) ||
    (idYear !== undefined && idYear === y);

  if (player.cardYear !== undefined && player.cardYear !== y) {
    return false;
  }
  if (idYear !== undefined && idYear !== y) {
    return false;
  }

  if (hasExplicitYear) {
    if (playerClubMatchesTeam(player, team)) return true;
    for (const spanClub of EXTRA_CLUB_SPANS[player.id] ?? []) {
      const mapped = RLP_CLUB_ALIASES[spanClub] ?? spanClub;
      if (mapped === team) return true;
    }
    return false;
  }

  if (!isPlayerActiveInYear(player, y)) {
    return false;
  }

  if (playerClubMatchesTeam(player, team)) {
    return true;
  }

  for (const spanClub of EXTRA_CLUB_SPANS[player.id] ?? []) {
    const mapped = RLP_CLUB_ALIASES[spanClub] ?? spanClub;
    if (mapped === team) return true;
  }

  return false;
}

export function describeTeamYearMembershipMismatch(
  player: Player,
  team: string,
  year: number | string
): string | null {
  if (playerBelongsToTeamYear(player, team, year)) return null;

  const y = typeof year === "string" ? Number.parseInt(year, 10) : year;
  const currentYear = new Date().getFullYear();

  if (player.category === "current" && y < currentYear) {
    return "current player leaked into historic team-year pool";
  }
  if (player.cardYear !== undefined && player.cardYear !== y) {
    return `cardYear ${player.cardYear} does not match team-year ${y}`;
  }
  const idYear = parseYearFromId(player.id);
  if (idYear !== undefined && idYear !== y) {
    return `player id year suffix ${idYear} does not match team-year ${y}`;
  }
  if (!isPlayerActiveInYear(player, y)) {
    return `player not active in ${y} (${player.yearsActive})`;
  }
  if (!playerClubMatchesTeam(player, team)) {
    return `player club ${player.club} does not match ${team}`;
  }
  return "player does not belong to team-year";
}
