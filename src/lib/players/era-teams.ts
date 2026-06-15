import type { Player, Position, SquadSlot } from "../types";
import { getAverageSquadRating } from "../squad-analysis";
import { getTeamTier } from "../team-tiers";
import { getClubByName } from "../clubs";
import { getPlayableClubNames } from "../clubs/super-league-display";
import { getPlayerById, getPlayersByClub, PLAYER_POOL } from "./index";
import { isHiddenPlayer } from "./goat";
import { withEraYear } from "./player-age";
import {
  SQUAD_STRUCTURE,
  createEmptySquad,
  getFilledCount,
  getSquadValue,
  signPlayerToSlot,
} from "../positions";
import {
  getEraWikipediaSquadPlayerIds,
  getEraWikipediaSquadPositions,
  getEraWikipediaYearsForClub,
  hasEraWikipediaSquad,
} from "./era-wikipedia-squads";

export const MIN_ERA_ROSTER_PLAYERS = 13;
export const FULL_ERA_SQUAD_SIZE = 13;
export const ERA_26_YEAR = "26";

export type EraTeamCategory = "26" | "historic";

/** Clubs playable in Era Challenge Cup — includes teams not in standard Challenge Cup. */
export const ERA_CHALLENGE_CLUBS = [
  "Bradford Bulls",
  "Wigan Warriors",
  "Leeds Rhinos",
  "St Helens",
  "Warrington Wolves",
  "Hull FC",
  "Hull KR",
  "Catalans Dragons",
  "Huddersfield Giants",
  "Castleford Tigers",
  "Wakefield Trinity",
  "Leigh Leopards",
  "Widnes Vikings",
  "London Broncos",
  "Salford Red Devils",
  "York Knights",
  "Toulouse Olympique",
] as const;

export type EraChallengeClub = (typeof ERA_CHALLENGE_CLUBS)[number];

const DERIVED_ROSTER_CLUBS = new Set<string>([
  "Widnes Vikings",
  "London Broncos",
  "Salford Red Devils",
]);

const DERIVED_CLUB_PLAYER_FILTERS: Record<
  string,
  (player: Player) => boolean
> = {
  "Widnes Vikings": (player) => player.id.startsWith("widnes-hist-"),
  "London Broncos": (player) =>
    player.club === "London Broncos" || player.id.startsWith("london-hist-"),
  "Salford Red Devils": (player) =>
    player.club === "Salford Red Devils" ||
    player.id.startsWith("salford-hist-"),
};

function getPlayersForEraClub(clubName: string): Player[] {
  if (DERIVED_ROSTER_CLUBS.has(clubName)) {
    const filter = DERIVED_CLUB_PLAYER_FILTERS[clubName];
    return filter ? PLAYER_POOL.filter(filter) : [];
  }
  return getPlayersByClub(clubName);
}

export interface EraTeam {
  id: string;
  clubName: string;
  year: string;
  displayName: string;
  category: EraTeamCategory;
  playerIds: string[];
  slotPositions: Position[];
  teamRating: number;
  teamValue: number;
  tier: string;
  keyPlayers: string[];
}

function slugifyClub(club: string): string {
  return club.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function formatEraDisplayName(clubName: string, year: string): string {
  const shortYear = year.length >= 2 ? year.slice(-2) : year;
  return `${clubName} '${shortYear.padStart(2, "0")}`;
}

export function formatEra26DisplayName(clubName: string): string {
  return `${clubName} ${ERA_26_YEAR}`;
}

export function isEra26Year(year: string): boolean {
  return year === ERA_26_YEAR;
}

export function getEraSquadYear(team: EraTeam): number | undefined {
  return isEra26Year(team.year) ? undefined : Number(team.year);
}

/** Strip era season suffix for club colour / lookup resolution. */
export function resolveEraTeamClubName(
  teamName: string,
  eraClubLookup?: Record<string, string>
): string {
  if (eraClubLookup?.[teamName]) return eraClubLookup[teamName];
  const historicMatch = teamName.match(/^(.+?) '\d{2}$/);
  if (historicMatch) return historicMatch[1];
  const modernMatch = teamName.match(/^(.+?) 26$/);
  if (modernMatch) return modernMatch[1];
  return teamName;
}

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

export function isPlayerActiveInYear(player: Player, year: number): boolean {
  const { start, end } = parseYearsActiveRange(player.yearsActive);
  if (start === 0) return false;
  if (year < start) return false;
  if (end !== null && year > end) return false;
  return true;
}

function getDerivedYearsForClub(clubName: string): string[] {
  const players = getPlayersForEraClub(clubName);
  const yearCounts = new Map<number, number>();

  for (const player of players) {
    const { start, end } = parseYearsActiveRange(player.yearsActive);
    if (start === 0) continue;
    const last = end ?? new Date().getFullYear();
    for (let y = start; y <= last; y++) {
      yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1);
    }
  }

  return [...yearCounts.entries()]
    .filter(([, count]) => count >= MIN_ERA_ROSTER_PLAYERS)
    .map(([year]) => String(year))
    .sort((a, b) => Number(b) - Number(a));
}

function getDerivedRosterPlayerIds(club: string, year: string): string[] {
  const y = Number(year);
  return getPlayersForEraClub(club)
    .filter((p) => isPlayerActiveInYear(p, y))
    .sort((a, b) => b.peakRating - a.peakRating)
    .map((p) => p.id);
}

export function getEraHistoricClubs(): EraChallengeClub[] {
  return ERA_CHALLENGE_CLUBS.filter(
    (club) => getEraHistoricYearsForClub(club).length > 0
  );
}

/** @deprecated Use getEraHistoricClubs — historic Wikipedia squads only. */
export function getEraClubs(): EraChallengeClub[] {
  return getEraHistoricClubs();
}

export function getEra26Clubs(): string[] {
  return getPlayableClubNames()
    .filter((club) => canBuildEra26Team(club))
    .sort((a, b) => a.localeCompare(b));
}

export function getEraHistoricYearsForClub(clubName: string): string[] {
  return getEraWikipediaYearsForClub(clubName).filter((year) => {
    const team = buildEraHistoricTeam(clubName, year);
    return team !== null;
  });
}

/** @deprecated Use getEraHistoricYearsForClub */
export function getEraYearsForClub(clubName: string): string[] {
  return getEraHistoricYearsForClub(clubName);
}

export function getCurrentSquadPlayerIds(clubName: string): string[] {
  return getPlayersByClub(clubName)
    .filter(
      (p) =>
        p.category === "current" &&
        p.availableInGame !== false &&
        !isHiddenPlayer(p)
    )
    .sort((a, b) => b.peakRating - a.peakRating)
    .map((p) => p.id);
}

function canBuildEra26Team(clubName: string): boolean {
  const playerIds = getCurrentSquadPlayerIds(clubName);
  if (playerIds.length < MIN_ERA_ROSTER_PLAYERS) return false;
  const squad = buildEraSquadFromRoster(playerIds);
  return getFilledCount(squad) >= FULL_ERA_SQUAD_SIZE;
}

export function getEraRosterPlayerIds(club: string, year: string): string[] {
  return getEraWikipediaSquadPlayerIds(club, year) ?? [];
}

export function buildEraSquadFromRoster(
  playerIds: string[],
  slotPositions?: Position[],
  eraYear?: number
): SquadSlot[] {
  let squad = createEmptySquad();

  const eraPlayer = (player: Player): Player =>
    eraYear !== undefined ? withEraYear(player, eraYear) : player;

  if (slotPositions && slotPositions.length === playerIds.length) {
    const slotsByPosition = new Map<Position, SquadSlot[]>();
    for (const slot of squad) {
      const list = slotsByPosition.get(slot.position) ?? [];
      list.push(slot);
      slotsByPosition.set(slot.position, list);
    }

    const usedSlots = new Set<number>();
    for (let i = 0; i < playerIds.length; i++) {
      const player = getPlayerById(playerIds[i]);
      const position = slotPositions[i];
      if (!player || !position) continue;
      const candidates = (slotsByPosition.get(position) ?? []).filter(
        (slot) => !usedSlots.has(slot.slotIndex)
      );
      const slot = candidates[0];
      if (!slot) continue;
      usedSlots.add(slot.slotIndex);
      squad = signPlayerToSlot(squad, eraPlayer(player), slot.slotIndex);
    }
    return squad;
  }

  const rosterPlayers = playerIds
    .map((id) => getPlayerById(id))
    .filter((p): p is Player => p !== undefined);

  const byPosition = new Map<Position, Player[]>();
  for (const player of rosterPlayers) {
    const list = byPosition.get(player.position) ?? [];
    list.push(player);
    byPosition.set(player.position, list);
  }

  for (const list of byPosition.values()) {
    list.sort((a, b) => b.peakRating - a.peakRating);
  }

  squad = createEmptySquad();
  const used = new Set<string>();

  for (const { position, count } of SQUAD_STRUCTURE) {
    const candidates = (byPosition.get(position) ?? []).filter(
      (p) => !used.has(p.id)
    );
    for (let i = 0; i < count; i++) {
      const pick = candidates[i];
      if (!pick) break;
      const slot = squad.find(
        (s) => s.position === position && s.player === null
      );
      if (!slot) break;
      used.add(pick.id);
      squad = signPlayerToSlot(squad, eraPlayer(pick), slot.slotIndex);
    }
  }

  return squad;
}

function expectedEraDisplayName(clubName: string, year: string): string {
  return isEra26Year(year)
    ? formatEra26DisplayName(clubName)
    : formatEraDisplayName(clubName, year);
}

function validateEraTeam(
  clubName: string,
  year: string,
  playerIds: string[],
  squad: SquadSlot[],
  teamRating: number,
  teamValue: number,
  displayName: string
): string | null {
  if (playerIds.length < MIN_ERA_ROSTER_PLAYERS) {
    return `roster has ${playerIds.length}/${MIN_ERA_ROSTER_PLAYERS} players`;
  }

  const filled = getFilledCount(squad);
  if (filled < FULL_ERA_SQUAD_SIZE) {
    return `squad fills ${filled}/${FULL_ERA_SQUAD_SIZE} structure slots`;
  }

  for (const { position, count } of SQUAD_STRUCTURE) {
    const positionFilled = squad.filter(
      (slot) => slot.position === position && slot.player
    ).length;
    if (positionFilled < count) {
      return `missing ${position} (${positionFilled}/${count})`;
    }
  }

  if (!Number.isFinite(teamRating) || teamRating <= 0) {
    return "invalid team rating";
  }

  if (!Number.isFinite(teamValue) || teamValue <= 0) {
    return "invalid team value";
  }

  if (!getClubByName(clubName)) {
    return "missing club colours";
  }

  if (displayName !== expectedEraDisplayName(clubName, year)) {
    return "invalid display name";
  }

  return null;
}

function buildEraTeamInternal(
  clubName: string,
  year: string,
  category: EraTeamCategory,
  playerIds: string[],
  slotPositions: Position[] | undefined,
  squadEraYear: number | undefined
): EraTeam | null {
  const displayName = expectedEraDisplayName(clubName, year);
  const squad = buildEraSquadFromRoster(
    playerIds,
    slotPositions,
    squadEraYear
  );
  const teamRating = getAverageSquadRating(squad);
  const teamValue = getSquadValue(squad);

  const validationError = validateEraTeam(
    clubName,
    year,
    playerIds,
    squad,
    teamRating,
    teamValue,
    displayName
  );
  if (validationError) {
    logEraValidationWarning(clubName, year, validationError);
    return null;
  }

  const filled = squad.filter((s) => s.player);
  const keyPlayers = filled
    .map((s) => s.player!)
    .sort((a, b) => b.peakRating - a.peakRating)
    .slice(0, 3)
    .map((p) => p.name);

  return {
    id: `${slugifyClub(clubName)}-${year}`,
    clubName,
    year,
    displayName,
    category,
    playerIds,
    slotPositions: slotPositions ?? [],
    teamRating,
    teamValue,
    tier: getTeamTier(teamRating),
    keyPlayers,
  };
}

function logEraValidationWarning(
  clubName: string,
  year: string,
  reason: string
): void {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[era-teams] Skipping ${expectedEraDisplayName(clubName, year)}: ${reason}`
    );
  }
}

export function buildEra26Team(clubName: string): EraTeam | null {
  if (!getPlayableClubNames().includes(clubName)) return null;
  const playerIds = getCurrentSquadPlayerIds(clubName);
  return buildEraTeamInternal(
    clubName,
    ERA_26_YEAR,
    "26",
    playerIds,
    undefined,
    undefined
  );
}

export function buildEraHistoricTeam(
  clubName: string,
  year: string
): EraTeam | null {
  if (!hasEraWikipediaSquad(clubName, year)) {
    return null;
  }

  const playerIds = getEraRosterPlayerIds(clubName, year);
  const slotPositions =
    getEraWikipediaSquadPositions(clubName, year) ?? undefined;

  return buildEraTeamInternal(
    clubName,
    year,
    "historic",
    playerIds,
    slotPositions,
    Number(year)
  );
}

/** Build a historic Wikipedia era team. */
export function buildEraTeam(clubName: string, year: string): EraTeam | null {
  return buildEraHistoricTeam(clubName, year);
}

export function buildEraTeamForCategory(
  clubName: string,
  category: EraTeamCategory,
  year?: string
): EraTeam | null {
  if (category === "26") return buildEra26Team(clubName);
  if (!year) return null;
  return buildEraHistoricTeam(clubName, year);
}

export function getAllEraTeams(): EraTeam[] {
  const teams: EraTeam[] = [];

  for (const club of getEra26Clubs()) {
    const team = buildEra26Team(club);
    if (team) teams.push(team);
  }

  for (const club of ERA_CHALLENGE_CLUBS) {
    for (const year of getEraHistoricYearsForClub(club)) {
      const team = buildEraHistoricTeam(club, year);
      if (team) teams.push(team);
    }
  }

  return teams;
}
