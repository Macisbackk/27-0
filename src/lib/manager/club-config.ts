import { getClubBaseStrength } from "../game/club-strength";
import { getClubByName, resolveClubUiColors } from "../clubs";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import type { Position } from "../types";
import { SQUAD_STRUCTURE } from "../positions";
import { getPlayerById } from "../players";
import { getPlayerEligiblePositions } from "../players/player-positions";
import {
  ERA_BENCH_FROM_STARTING_17,
  ERA_XIII_FROM_STARTING_17,
} from "../players/era-starting-17s";
import {
  computeManagerTeamRating,
  getManagerClubTeamRating,
  getManagerRosterIds,
} from "./managerRating";

export interface ManagerClubConfig {
  name: string;
  expectation: string;
  expectationTier: ManagerClubExpectationTier;
  budget: number;
  difficulty: number;
  squadRating: number;
  primaryColor: string;
  secondaryColor: string;
}

export type ManagerClubExpectationTier =
  | "title"
  | "playoffs"
  | "mid-table"
  | "avoid-bottom"
  | "survive";

export const MANAGER_EXPECTATION_LABELS: Record<
  ManagerClubExpectationTier,
  string
> = {
  title: "Win the title",
  playoffs: "Reach playoffs",
  "mid-table": "Mid-table push",
  "avoid-bottom": "Avoid bottom",
  survive: "Survive and develop",
};

const CLUB_BUDGET: Record<string, number> = {
  "Wigan Warriors": 1_200_000,
  "St Helens": 1_150_000,
  "Leeds Rhinos": 1_000_000,
  "Warrington Wolves": 950_000,
  "Hull KR": 850_000,
  "Catalans Dragons": 820_000,
  "Hull FC": 780_000,
  "Toulouse Olympique": 760_000,
  "Leigh Leopards": 740_000,
  "Huddersfield Giants": 680_000,
  "Castleford Tigers": 620_000,
  "Bradford Bulls": 650_000,
  "Wakefield Trinity": 520_000,
  "York Knights": 500_000,
};

function difficultyFromStrength(strength: number): number {
  if (strength >= 82) return 5;
  if (strength >= 78) return 4;
  if (strength >= 74) return 3;
  if (strength >= 70) return 2;
  return 1;
}

function getLeagueSquadRatings(): number[] {
  return CURRENT_PLAYABLE_CLUBS.map((name) => getManagerClubRating(name));
}

/** Board expectation tier from squad OVR — clubs on the same rating band share the same bio. */
export function getManagerClubExpectationTier(
  squadRating: number,
  allRatings: readonly number[]
): ManagerClubExpectationTier {
  const bands = [...new Set(allRatings)].sort((a, b) => b - a);
  const bandIndex = bands.indexOf(squadRating);
  if (bandIndex < 0) return "mid-table";

  const totalBands = bands.length;
  if (bandIndex === 0) return "title";
  if (bandIndex === 1 || totalBands <= 2) return "playoffs";

  const remaining = totalBands - 2;
  const relIndex = bandIndex - 2;

  if (remaining === 1) return "mid-table";
  if (remaining === 2) {
    return relIndex === 0 ? "mid-table" : "avoid-bottom";
  }
  if (remaining === 3) {
    if (relIndex === 0) return "mid-table";
    if (relIndex === 1) return "avoid-bottom";
    return "survive";
  }

  const fraction = relIndex / (remaining - 1);
  if (fraction < 0.34) return "mid-table";
  if (fraction < 0.67) return "avoid-bottom";
  return "survive";
}

export function getManagerClubExpectation(
  squadRating: number,
  allRatings?: readonly number[]
): string {
  const ratings = allRatings ?? getLeagueSquadRatings();
  const tier = getManagerClubExpectationTier(squadRating, ratings);
  return MANAGER_EXPECTATION_LABELS[tier];
}

export function didMeetManagerBoardExpectation(
  tier: ManagerClubExpectationTier,
  position: number,
  playoffFinish: string | null
): boolean {
  switch (tier) {
    case "title":
      return playoffFinish === "Super League Champions";
    case "playoffs":
      return position <= 6;
    case "mid-table":
      return position <= 10;
    case "avoid-bottom":
    case "survive":
      return position <= 12;
  }
}

export function getManagerClubRating(clubName: string): number {
  return getManagerClubTeamRating(clubName);
}

export function getManagerClubConfig(clubName: string): ManagerClubConfig {
  const club = getClubByName(clubName);
  const strength = getClubBaseStrength(clubName);
  const uiColors = club
    ? resolveClubUiColors(club.primaryColor, club.secondaryColor)
    : { primary: "#1e293b", secondary: "#334155" };
  const allRatings = getLeagueSquadRatings();
  const squadRating = getManagerClubRating(clubName);
  const expectationTier = getManagerClubExpectationTier(squadRating, allRatings);
  return {
    name: clubName,
    expectation: MANAGER_EXPECTATION_LABELS[expectationTier],
    expectationTier,
    budget: CLUB_BUDGET[clubName] ?? 600_000,
    difficulty: difficultyFromStrength(strength),
    squadRating,
    primaryColor: uiColors.primary,
    secondaryColor: uiColors.secondary,
  };
}

export function getAllManagerClubConfigs(): ManagerClubConfig[] {
  return CURRENT_PLAYABLE_CLUBS.map((name) => getManagerClubConfig(name));
}

/** Map squad OVR to 1–5 stars relative to the playable league (best = 5). */
export function squadRatingToStars(
  rating: number,
  allRatings: readonly number[]
): number {
  if (allRatings.length === 0) return 3;
  const min = Math.min(...allRatings);
  const max = Math.max(...allRatings);
  if (max <= min) return 3;
  return Math.max(1, Math.min(5, Math.round(((rating - min) / (max - min)) * 4) + 1));
}

export function formatSquadRatingStars(stars: number): string {
  const filled = Math.max(0, Math.min(5, stars));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

export function buildDefaultLineup(playerIds: readonly string[]): {
  xiiiIds: string[];
  slotPositions: Position[];
  benchIds: string[];
} | null {
  const players = playerIds
    .map((id) => getPlayerById(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => (b.rating ?? b.peakRating) - (a.rating ?? a.peakRating));

  const lineup: Position[] = [];
  for (const { position, count } of SQUAD_STRUCTURE) {
    for (let i = 0; i < count; i++) lineup.push(position);
  }

  const used = new Set<string>();
  const xiiiIds: string[] = [];
  const slotPositions: Position[] = [];

  for (const position of lineup) {
    const pick = players.find(
      (p) =>
        !used.has(p.id) && getPlayerEligiblePositions(p).includes(position)
    );
    if (!pick) return null;
    used.add(pick.id);
    xiiiIds.push(pick.id);
    slotPositions.push(position);
  }

  const benchIds = playerIds
    .filter((id) => !used.has(id))
    .slice(0, ERA_BENCH_FROM_STARTING_17);

  return { xiiiIds, slotPositions, benchIds };
}
