import { getClubByName, resolveClubUiColors } from "../clubs";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import type { Position } from "../types";
import { FORMATION_SLOT_POSITIONS } from "../positions";
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
  playoffs: "Reach the play-offs",
  "mid-table": "Mid-table finish",
  "avoid-bottom": "Avoid the bottom",
  survive: "Survive and develop",
};

/** Short tier summary for club-select group headers (matches star-based board targets). */
export const MANAGER_STAR_TIER_BIOS: Record<number, string> = {
  5: "Title contenders — win the Grand Final",
  4: "Play-off push — finish in the top six",
  3: "Mid-table finish — build toward the top half",
  2: "Stay clear of the bottom places",
  1: "Survive and develop — every point counts",
};

/** Fixed board star ratings for select clubs; others derive from squad OVR rank. */
const CLUB_STAR_OVERRIDES: Record<string, number> = {
  "Leeds Rhinos": 5,
  "St Helens": 5,
  "Wigan Warriors": 5,
  "Hull KR": 4,
  "Warrington Wolves": 4,
  "Huddersfield Giants": 2,
  "York Knights": 1,
};

const TRANSFER_BUDGET_MID_BY_STARS: Record<number, number> = {
  5: 1_000_000,
  4: 723_000,
  3: 510_000,
  2: 332_000,
  1: 230_000,
};

function getLeagueSquadRatings(): number[] {
  return CURRENT_PLAYABLE_CLUBS.map((name) => getManagerClubRating(name));
}

function getSquadRatingRank(
  squadRating: number,
  allRatings: readonly number[]
): number {
  return allRatings.filter((r) => r > squadRating).length + 1;
}

/** Board expectation tier from squad OVR rank — top five title contenders, sixth fights for playoffs. */
export function getManagerClubExpectationTier(
  squadRating: number,
  allRatings: readonly number[]
): ManagerClubExpectationTier {
  if (allRatings.length === 0) return "mid-table";

  const rank = getSquadRatingRank(squadRating, allRatings);
  const total = allRatings.length;

  if (rank <= 5) return "title";
  if (rank === 6) return "playoffs";

  const fromBottom = total - rank;
  if (fromBottom <= 1) return "survive";
  if (fromBottom <= 3) return "avoid-bottom";
  return "mid-table";
}

export function getManagerClubExpectation(
  squadRating: number,
  allRatings?: readonly number[]
): string {
  const ratings = allRatings ?? getLeagueSquadRatings();
  const tier = getManagerClubExpectationTier(squadRating, ratings);
  return MANAGER_EXPECTATION_LABELS[tier];
}

/** Board expectation tier from the club's current 1–5 star status. */
export function expectationTierFromStars(stars: number): ManagerClubExpectationTier {
  if (stars >= 5) return "title";
  if (stars >= 4) return "playoffs";
  if (stars >= 3) return "mid-table";
  if (stars >= 2) return "avoid-bottom";
  return "survive";
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
  const uiColors = club
    ? resolveClubUiColors(
        club.primaryColor,
        club.secondaryColor,
        club.accentColor
      )
    : { primary: "#1e293b", secondary: "#334155" };
  const squadRating = getManagerClubRating(clubName);
  const stars = getManagerClubStarRating(clubName);
  const expectationTier = expectationTierFromStars(stars);
  return {
    name: clubName,
    expectation: MANAGER_EXPECTATION_LABELS[expectationTier],
    expectationTier,
    budget: TRANSFER_BUDGET_MID_BY_STARS[stars] ?? TRANSFER_BUDGET_MID_BY_STARS[3]!,
    difficulty: stars,
    squadRating,
    primaryColor: uiColors.primary,
    secondaryColor: uiColors.secondary,
  };
}

export function getAllManagerClubConfigs(): ManagerClubConfig[] {
  return CURRENT_PLAYABLE_CLUBS.map((name) => getManagerClubConfig(name));
}

/** Club prestige stars (1–5) — overrides for named clubs, else from squad OVR rank. */
export function getManagerClubStarRating(clubName: string): number {
  const override = CLUB_STAR_OVERRIDES[clubName];
  if (override !== undefined) return override;
  const allRatings = getLeagueSquadRatings();
  return squadRatingToStars(getManagerClubRating(clubName), allRatings);
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
    .sort((a, b) => b.peakRating - a.peakRating);

  const lineup: Position[] = [...FORMATION_SLOT_POSITIONS];

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
