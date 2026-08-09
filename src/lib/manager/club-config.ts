import { getClubByName, resolveClubUiColors } from "../clubs";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import {
  CHAMPIONSHIP_CLUBS,
  getChampionshipClubByName,
} from "../clubs/championship-clubs";
import type { Position, Player } from "../types";
import { FORMATION_SLOT_POSITIONS } from "../positions";
import { getPlayerById } from "../players";
import { getPlayerEligiblePositions } from "../players/player-positions";
import {
  ERA_BENCH_FROM_STARTING_17,
} from "../players/era-starting-17s";
import {
  getManagerClubTeamRating,
} from "./managerRating";
import {
  CLUB_REPUTATION_BY_NAME,
  CLUB_REPUTATION_SCHEMA_VERSION,
  getClubReputationStars,
  type ClubStarRating,
} from "../../../data/club-reputation";
import type { ManagerCompetitionId } from "./types";

export { CLUB_REPUTATION_SCHEMA_VERSION, type ClubStarRating };

export interface ManagerClubConfig {
  name: string;
  expectation: string;
  expectationTier: ManagerClubExpectationTier;
  budget: number;
  difficulty: number;
  squadRating: number;
  primaryColor: string;
  secondaryColor: string;
  competition?: ManagerCompetitionId;
}

export type ManagerClubExpectationTier =
  | "title"
  | "top"
  | "playoffs"
  | "mid-table"
  | "avoid-bottom"
  | "survive";

export const MANAGER_EXPECTATION_LABELS: Record<
  ManagerClubExpectationTier,
  string
> = {
  title: "Win the title",
  top: "Push for the top",
  playoffs: "Make the play-offs",
  "mid-table": "Mid-table finish",
  "avoid-bottom": "Avoid the bottom",
  survive: "Survive",
};

export const CHAMPIONSHIP_EXPECTATION_LABELS: Record<
  ManagerClubExpectationTier,
  string
> = {
  title: "Win the Championship",
  top: "Push for promotion",
  playoffs: "Finish top four",
  "mid-table": "Mid-table finish",
  "avoid-bottom": "Avoid the bottom",
  survive: "Survive",
};

/** One board-expectation tier per star rating — used for careers and club select bios. */
export const STAR_EXPECTATION_TIER_BY_STARS: Record<
  1 | 2 | 3 | 4 | 5,
  ManagerClubExpectationTier
> = {
  5: "title",
  4: "top",
  3: "playoffs",
  2: "mid-table",
  1: "survive",
};

/** Short tier summary for club-select group headers (matches star-based board targets). */
export const MANAGER_STAR_TIER_BIOS: Record<number, string> = {
  5: "Win the title — Grand Final favourites",
  4: "Push for the top — challenge the leading pack",
  3: "Make the play-offs — finish in the top six",
  2: "Mid-table finish — solid Super League campaign",
  1: "Survive — stay clear of the bottom places",
};

export const CHAMPIONSHIP_STAR_TIER_BIOS: Record<number, string> = {
  3: "Win the Championship / push for promotion",
  2: "Push for promotion — finish in the top two",
  1: "Build toward mid-table — stay clear of the bottom",
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
  const clamped = Math.max(1, Math.min(5, Math.round(stars))) as 1 | 2 | 3 | 4 | 5;
  return STAR_EXPECTATION_TIER_BY_STARS[clamped];
}

export function championshipStarsFromBaseStrength(baseStrength: number): ClubStarRating {
  if (baseStrength >= 70) return 3;
  if (baseStrength >= 65) return 2;
  return 1;
}

/** Map Champ baseStrength (~55–75) onto a display OVR band. */
export function championshipSquadRatingFromBaseStrength(
  baseStrength: number
): number {
  return Math.round(68 + ((baseStrength - 55) / 20) * 12);
}

export function didMeetManagerBoardExpectation(
  tier: ManagerClubExpectationTier,
  position: number,
  playoffFinish: string | null,
  competition: ManagerCompetitionId = "super-league"
): boolean {
  if (competition === "championship") {
    switch (tier) {
      case "title":
        return position === 1;
      case "top":
        return position <= 2;
      case "playoffs":
        return position <= 4;
      case "mid-table":
        return position <= 10;
      case "avoid-bottom":
      case "survive":
        return position <= 18;
    }
  }

  switch (tier) {
    case "title":
      return playoffFinish === "Super League Champions";
    case "top":
      return position <= 3;
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
  const champ = getChampionshipClubByName(clubName);
  if (champ) {
    return championshipSquadRatingFromBaseStrength(champ.baseStrength);
  }
  return getManagerClubTeamRating(clubName);
}

function getChampionshipManagerClubConfig(
  clubName: string
): ManagerClubConfig | null {
  const champ = getChampionshipClubByName(clubName);
  if (!champ || !champ.managerSelectable) return null;

  const uiColors = resolveClubUiColors(
    champ.primaryColor,
    champ.secondaryColor,
    champ.accentColor
  );
  const stars = championshipStarsFromBaseStrength(champ.baseStrength);
  const expectationTier = expectationTierFromStars(stars);
  const midBudget =
    TRANSFER_BUDGET_MID_BY_STARS[stars] ?? TRANSFER_BUDGET_MID_BY_STARS[3]!;
  return {
    name: clubName,
    expectation: CHAMPIONSHIP_EXPECTATION_LABELS[expectationTier],
    expectationTier,
    budget: Math.round(midBudget * 0.85),
    difficulty: stars,
    squadRating: championshipSquadRatingFromBaseStrength(champ.baseStrength),
    primaryColor: uiColors.primary,
    secondaryColor: uiColors.secondary,
    competition: "championship",
  };
}

export function getManagerClubConfig(clubName: string): ManagerClubConfig {
  const champConfig = getChampionshipManagerClubConfig(clubName);
  if (champConfig) return champConfig;

  const club = getClubByName(clubName);
  const uiColors = club
    ? resolveClubUiColors(
        club.primaryColor,
        club.secondaryColor,
        club.accentColor
      )
    : { primary: "#1e293b", secondary: "#334155" };
  const squadRating = getManagerClubTeamRating(clubName);
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
    competition: "super-league",
  };
}

export function getAllManagerClubConfigs(): ManagerClubConfig[] {
  const sl = CURRENT_PLAYABLE_CLUBS.map((name) => getManagerClubConfig(name));
  const champ = CHAMPIONSHIP_CLUBS.filter((c) => c.managerSelectable).map((c) =>
    getManagerClubConfig(c.name)
  );
  return [...sl, ...champ];
}

/**
 * Canonical club prestige stars (1–5).
 * Reads fixed reputation data — never in-season squad OVR.
 */
export function getManagerClubStarRating(clubName: string): ClubStarRating {
  const fromCanon = getClubReputationStars(clubName);
  if (fromCanon != null) return fromCanon;
  const champ = getChampionshipClubByName(clubName);
  if (champ) return championshipStarsFromBaseStrength(champ.baseStrength);
  // Unknown clubs: mid-tier default (should not happen for playable clubs).
  if (process.env.NODE_ENV === "development") {
    console.warn(`[club-reputation] missing stars for ${clubName}`);
  }
  return 3;
}

/** @deprecated Prefer getManagerClubStarRating — kept for callers that used OVR mapping. */
export function getManagerClubStarRatingLegacyDerived(
  clubName: string
): number {
  const fromCanon = CLUB_REPUTATION_BY_NAME[clubName];
  if (fromCanon != null) return fromCanon;
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

  return buildDefaultLineupFromPlayers(playerIds, players);
}

/** Lineup builder that accepts an explicit player pool (e.g. Champ registry). */
export function buildDefaultLineupFromPlayers(
  playerIds: readonly string[],
  players: readonly Player[]
): {
  xiiiIds: string[];
  slotPositions: Position[];
  benchIds: string[];
} | null {
  const ranked = [...players].sort((a, b) => b.peakRating - a.peakRating);
  const lineup: Position[] = [...FORMATION_SLOT_POSITIONS];

  const used = new Set<string>();
  const xiiiIds: string[] = [];
  const slotPositions: Position[] = [];

  for (const position of lineup) {
    const pick = ranked.find(
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
