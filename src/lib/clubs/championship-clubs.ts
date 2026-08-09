import championshipClubsData from "../../../data/championship-clubs.json";
import clubsData from "../../../data/clubs.json";
import type { Club } from "../clubs";

export type CompetitionTier2026 = "championship";
export type PreviousTier2025 = "championship" | "league-one";

export interface ChampionshipClub {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  country: string;
  competitionTier2026: CompetitionTier2026;
  previousTier2025?: PreviousTier2025;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  textColour?: string;
  challengeCupEligible: boolean;
  managerSelectable: boolean;
  generatedSquad: boolean;
  baseStrength: number;
  active?: boolean;
  isCurrentSuperLeague?: boolean;
  playable?: boolean;
  league?: "super_league" | "nrl" | "qld_cup";
}

const FROM_JSON = championshipClubsData as ChampionshipClub[];

const EMBEDDED_CHAMPIONSHIP_IDS = new Set([
  "london",
  "widnes",
  "halifax",
  "sheffield",
  "oldham",
]);

function asChampionshipClub(
  club: Club & Partial<ChampionshipClub>
): ChampionshipClub | null {
  if (club.competitionTier2026 !== "championship") return null;
  return {
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    abbreviation: club.abbreviation ?? club.shortName,
    country: club.country ?? "England",
    competitionTier2026: "championship",
    previousTier2025: club.previousTier2025,
    primaryColor: club.primaryColor,
    secondaryColor: club.secondaryColor,
    accentColor: club.accentColor,
    textColour: club.textColour ?? "#FFFFFF",
    challengeCupEligible: club.challengeCupEligible ?? true,
    managerSelectable: club.managerSelectable ?? false,
    generatedSquad: club.generatedSquad ?? true,
    baseStrength: club.baseStrength ?? 62,
    active: club.active,
    isCurrentSuperLeague: false,
    playable: false,
    league: "super_league",
  };
}

/** All 20 active 2026 Championship clubs (stable IDs, not indexes). */
export const CHAMPIONSHIP_CLUBS: ChampionshipClub[] = (() => {
  const fromJson = FROM_JSON.map((c) => ({
    ...c,
    league: "super_league" as const,
    active: true,
    isCurrentSuperLeague: false,
    playable: false,
  }));
  const embedded = (clubsData as Club[])
    .filter((c) => EMBEDDED_CHAMPIONSHIP_IDS.has(c.id))
    .map((c) => asChampionshipClub(c as Club & Partial<ChampionshipClub>))
    .filter((c): c is ChampionshipClub => c != null);

  const byId = new Map<string, ChampionshipClub>();
  for (const club of [...fromJson, ...embedded]) {
    byId.set(club.id, club);
  }
  const list = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (list.length !== 20) {
    console.warn(`[championship] Expected 20 clubs, found ${list.length}`);
  }
  return list;
})();

export const CHAMPIONSHIP_CLUB_IDS = CHAMPIONSHIP_CLUBS.map((c) => c.id);

export const CHAMPIONSHIP_CLUB_NAMES = CHAMPIONSHIP_CLUBS.map((c) => c.name);

export const FORMER_LEAGUE_ONE_2025_IDS = CHAMPIONSHIP_CLUBS.filter(
  (c) => c.previousTier2025 === "league-one"
).map((c) => c.id);

export function getChampionshipClubById(
  id: string
): ChampionshipClub | undefined {
  return CHAMPIONSHIP_CLUBS.find((c) => c.id === id);
}

export function getChampionshipClubByName(
  name: string
): ChampionshipClub | undefined {
  const lower = name.toLowerCase();
  return CHAMPIONSHIP_CLUBS.find(
    (c) =>
      c.name === name ||
      c.id === name ||
      c.shortName === name ||
      c.abbreviation === name ||
      c.name.toLowerCase() === lower
  );
}

export function isChampionshipClubName(name: string): boolean {
  return getChampionshipClubByName(name) != null;
}

export function getChampionshipClubNames(): string[] {
  return [...CHAMPIONSHIP_CLUB_NAMES];
}

/** Extra clubs merged into the central lookup (new Championship-only rows). */
export function getChampionshipOnlyClubsAsClub(): Club[] {
  return FROM_JSON.map((c) => ({
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    primaryColor: c.primaryColor,
    secondaryColor: c.secondaryColor,
    accentColor: c.accentColor,
    active: true,
    isCurrentSuperLeague: false,
    playable: false,
    league: "super_league",
    abbreviation: c.abbreviation,
    country: c.country,
    competitionTier2026: c.competitionTier2026,
    previousTier2025: c.previousTier2025,
    textColour: c.textColour,
    challengeCupEligible: c.challengeCupEligible,
    managerSelectable: c.managerSelectable,
    generatedSquad: c.generatedSquad,
    baseStrength: c.baseStrength,
  }));
}
