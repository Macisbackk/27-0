import type { Player, Position, SquadSlot } from "../types";
import { getAverageSquadRating } from "../squad-analysis";
import { getTeamTier } from "../team-tiers";
import { getClubByName } from "../clubs";
import { getPlayableClubNames } from "../clubs/super-league-display";
import { getPlayerById, getPlayersByClub } from "./index";
import { isHiddenPlayer } from "./goat";
import { withEraYear } from "./player-age";
import { withRunClub } from "./run-club";
import {
  SQUAD_STRUCTURE,
  createEmptySquad,
  getFilledCount,
  getSquadValue,
  signPlayerToSlot,
} from "../positions";
import {
  ERA_BENCH_FROM_STARTING_17,
  ERA_STARTING_17_SIZE,
  ERA_XIII_FROM_STARTING_17,
  getEraStarting17YearsForClub,
  hasEraStarting17Squad,
  resolveEraStarting17Squad,
} from "./era-starting-17s";
import type { BracketMatch } from "../game/challenge-cup-bracket";
import { getCurrentCalendarYear } from "./team-year-rosters";

export const MIN_ERA_ROSTER_PLAYERS = 13;
export const FULL_ERA_SQUAD_SIZE = 13;
export const ERA_HISTORIC_ROSTER_SIZE = ERA_STARTING_17_SIZE;
export const ERA_26_YEAR = "2026";

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

export interface EraTeam {
  id: string;
  clubName: string;
  year: string;
  displayName: string;
  category: EraTeamCategory;
  /** Full roster — 17 for historic era squads. */
  playerIds: string[];
  /** Starting XIII player IDs (jerseys 1–13). */
  xiiiPlayerIds: string[];
  /** Bench player IDs (jerseys 14–17). */
  benchPlayerIds: string[];
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

/** @deprecated Use formatEraDisplayName(clubName, ERA_26_YEAR) */
export function formatEra26DisplayName(clubName: string): string {
  return formatEraDisplayName(clubName, ERA_26_YEAR);
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

export interface EraTournamentClubGroup {
  club: string;
  teams: { displayName: string; yearLabel: string }[];
}

/** Group era tournament teams by underlying club (e.g. Bradford '03 + '26 → Bradford Bulls). */
export function buildEraTournamentClubGroups(
  matches: BracketMatch[],
  eraClubLookup?: Record<string, string>
): EraTournamentClubGroup[] {
  const byClub = new Map<string, Set<string>>();

  for (const match of matches) {
    for (const team of [match.homeTeam, match.awayTeam]) {
      if (!team) continue;
      const club = resolveEraTeamClubName(team, eraClubLookup);
      const set = byClub.get(club) ?? new Set();
      set.add(team);
      byClub.set(club, set);
    }
  }

  return [...byClub.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([club, teamSet]) => ({
      club,
      teams: [...teamSet]
        .sort((a, b) => a.localeCompare(b))
        .map((displayName) => ({
          displayName,
          yearLabel: displayName,
        })),
    }));
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
  const currentYear = getCurrentCalendarYear();
  return getEraStarting17YearsForClub(clubName).filter(
    (year) => Number(year) <= currentYear
  );
}

export function getEraClubsWithTeams(): string[] {
  const clubs = new Set<string>();

  for (const club of ERA_CHALLENGE_CLUBS) {
    if (getEraYearsForClubUnified(club).length > 0) {
      clubs.add(club);
    }
  }

  for (const club of getPlayableClubNames()) {
    if (getEraYearsForClubUnified(club).length > 0) {
      clubs.add(club);
    }
  }

  return [...clubs].sort((a, b) => a.localeCompare(b));
}

export function getEraYearsForClubUnified(clubName: string): string[] {
  const years = new Set<string>();

  for (const year of getEraHistoricYearsForClub(clubName)) {
    years.add(year);
  }

  if (canBuildEra26Team(clubName)) {
    years.add(ERA_26_YEAR);
  }

  return [...years].sort((a, b) => Number(b) - Number(a));
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
  return resolveEraStarting17Squad(club, year)?.playerIds ?? [];
}

const eraTeamByDisplayName = new Map<string, EraTeam>();

function indexEraTeams(teams: EraTeam[]): void {
  eraTeamByDisplayName.clear();
  for (const team of teams) {
    eraTeamByDisplayName.set(team.displayName, team);
  }
}

/** Lookup a built era team by its display name (e.g. Bradford Bulls '03). */
export function getEraTeamByDisplayName(
  displayName: string,
  teams?: EraTeam[]
): EraTeam | null {
  if (teams) {
    return teams.find((team) => team.displayName === displayName) ?? null;
  }
  if (eraTeamByDisplayName.size === 0) {
    indexEraTeams(getAllEraTeams());
  }
  return eraTeamByDisplayName.get(displayName) ?? null;
}

/** Era team XIII with run-context club stamped on each player. */
export function getEraTeamMatchSquad(eraTeam: EraTeam): Player[] {
  const eraYear = getEraSquadYear(eraTeam);
  const matchIds =
    eraTeam.xiiiPlayerIds.length > 0
      ? eraTeam.xiiiPlayerIds
      : eraTeam.playerIds.slice(0, FULL_ERA_SQUAD_SIZE);
  return matchIds
    .map((id) => getPlayerById(id))
    .filter((player): player is Player => player !== undefined)
    .map((player) =>
      withRunClub(player, eraTeam.displayName, { eraYear })
    );
}

export function buildEraSquadFromRoster(
  playerIds: string[],
  slotPositions?: Position[],
  eraYear?: number,
  runClub?: string
): SquadSlot[] {
  let squad = createEmptySquad();

  const eraPlayer = (player: Player): Player => {
    const withYear =
      eraYear !== undefined ? withEraYear(player, eraYear) : player;
    return runClub ? withRunClub(withYear, runClub, { eraYear }) : withYear;
  };

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
  return formatEraDisplayName(clubName, year);
}

function validateEraTeam(
  clubName: string,
  year: string,
  category: EraTeamCategory,
  playerIds: string[],
  xiiiPlayerIds: string[],
  benchPlayerIds: string[],
  squad: SquadSlot[],
  teamRating: number,
  teamValue: number,
  displayName: string
): string | null {
  if (category === "historic") {
    if (playerIds.length !== ERA_HISTORIC_ROSTER_SIZE) {
      return `roster has ${playerIds.length}/${ERA_HISTORIC_ROSTER_SIZE} players`;
    }
    if (xiiiPlayerIds.length !== ERA_XIII_FROM_STARTING_17) {
      return `XIII has ${xiiiPlayerIds.length}/${ERA_XIII_FROM_STARTING_17} players`;
    }
    if (benchPlayerIds.length !== ERA_BENCH_FROM_STARTING_17) {
      return `bench has ${benchPlayerIds.length}/${ERA_BENCH_FROM_STARTING_17} players`;
    }
    const unique = new Set(playerIds);
    if (
      unique.size !== playerIds.length &&
      unique.size < ERA_HISTORIC_ROSTER_SIZE - 1
    ) {
      return "excessive duplicate player IDs in roster";
    }
  } else if (playerIds.length < MIN_ERA_ROSTER_PLAYERS) {
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
  xiiiPlayerIds: string[],
  benchPlayerIds: string[],
  slotPositions: Position[] | undefined,
  squadEraYear: number | undefined
): EraTeam | null {
  const displayName = expectedEraDisplayName(clubName, year);

  const historicXiiiIds =
    xiiiPlayerIds.length > 0
      ? xiiiPlayerIds
      : playerIds.slice(0, FULL_ERA_SQUAD_SIZE);
  const xiiiPositions =
    slotPositions && slotPositions.length >= FULL_ERA_SQUAD_SIZE
      ? slotPositions.slice(0, FULL_ERA_SQUAD_SIZE)
      : slotPositions;

  const squad = buildEraSquadFromRoster(
    category === "historic" ? historicXiiiIds : playerIds,
    category === "historic" ? xiiiPositions : undefined,
    squadEraYear
  );
  const teamRating = getAverageSquadRating(squad);
  const teamValue = getSquadValue(squad);

  const resolvedXiiiIds =
    category === "historic"
      ? historicXiiiIds
      : squad
          .filter((slot) => slot.player)
          .map((slot) => slot.player!.id);
  const resolvedBenchIds =
    category === "historic"
      ? benchPlayerIds
      : playerIds.filter((id) => !resolvedXiiiIds.includes(id)).slice(0, ERA_BENCH_FROM_STARTING_17);

  const validationError = validateEraTeam(
    clubName,
    year,
    category,
    playerIds,
    resolvedXiiiIds,
    resolvedBenchIds,
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
    xiiiPlayerIds: resolvedXiiiIds,
    benchPlayerIds: resolvedBenchIds,
    slotPositions:
      category === "historic"
        ? (xiiiPositions ?? [])
        : filled.map((slot) => slot.position),
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
    [],
    [],
    undefined,
    undefined
  );
}

export function buildEraHistoricTeam(
  clubName: string,
  year: string
): EraTeam | null {
  if (!hasEraStarting17Squad(clubName, year)) {
    return null;
  }

  const resolved = resolveEraStarting17Squad(clubName, year);
  if (
    !resolved ||
    resolved.playerIds.length !== ERA_HISTORIC_ROSTER_SIZE ||
    resolved.xiiiPlayerIds.length !== ERA_XIII_FROM_STARTING_17 ||
    resolved.benchPlayerIds.length !== ERA_BENCH_FROM_STARTING_17
  ) {
    return null;
  }

  return buildEraTeamInternal(
    clubName,
    year,
    "historic",
    resolved.playerIds,
    resolved.xiiiPlayerIds,
    resolved.benchPlayerIds,
    resolved.slotPositions,
    Number(year)
  );
}

/** Build a historic Wikipedia era team. */
export function buildEraTeam(clubName: string, year: string): EraTeam | null {
  return buildEraHistoricTeam(clubName, year);
}

export function buildEraTeamForYear(
  clubName: string,
  year: string
): EraTeam | null {
  if (isEra26Year(year)) return buildEra26Team(clubName);
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

  for (const club of getEraClubsWithTeams()) {
    for (const year of getEraYearsForClubUnified(club)) {
      const team = buildEraTeamForYear(club, year);
      if (team) teams.push(team);
    }
  }

  indexEraTeams(teams);
  return teams;
}
