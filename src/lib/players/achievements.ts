import type { Player } from "../types";
import manOfSteelWinners from "../../../data/man-of-steel-winners.json";
import lanceToddWinners from "../../../data/lance-todd-winners.json";
import dreamTeamYearsData from "../../../data/dream-team-years.json";
import goldenBootYearsData from "../../../data/golden-boot-years.json";
import leagueLeadersYearsData from "../../../data/league-leaders-years.json";
import superLeagueChampionYearsData from "../../../data/super-league-champion-years.json";
import challengeCupYearsData from "../../../data/challenge-cup-years.json";

const MOS_WINNERS = manOfSteelWinners as Record<string, number[]>;
const LANCE_TODD_WINNERS = new Set(lanceToddWinners as string[]);
const DREAM_TEAM_YEARS = dreamTeamYearsData as Record<string, number[]>;
const GOLDEN_BOOT_YEARS = goldenBootYearsData as Record<string, number[]>;
const LEAGUE_LEADERS_YEARS = leagueLeadersYearsData as Record<string, number[]>;
const SUPER_LEAGUE_CHAMPION_YEARS = superLeagueChampionYearsData as Record<
  string,
  number[]
>;
const CHALLENGE_CUP_YEARS = challengeCupYearsData as Record<string, number[]>;

export type AchievementCategoryId =
  | "individualHonours"
  | "leagueTitles"
  | "challengeCups";

export type AchievementDisplayMode = "compact" | "showcase" | "expanded";

export interface PlayerAchievement {
  label: string;
  color: "gold" | "green" | "purple" | "blue" | "silver";
  category: AchievementCategoryId;
  /** When set, cards render one collapsible Dream Team chip with year sub-chips. */
  dreamTeamYears?: number[];
  /** When set, cards render one collapsible Golden Boot chip with year sub-chips. */
  goldenBootYears?: number[];
  /** When set, cards render one collapsible League Leaders chip with year sub-chips. */
  leagueLeadersYears?: number[];
  /** When set, cards render one collapsible Super League Champion chip with year sub-chips. */
  superLeagueChampionYears?: number[];
  /** When set, cards render one collapsible Challenge Cup chip with year sub-chips. */
  challengeCupYears?: number[];
}

export interface PlayerAchievementGroup {
  category: AchievementCategoryId;
  title: string;
  achievements: PlayerAchievement[];
}

export const ACHIEVEMENT_CATEGORY_ORDER: AchievementCategoryId[] = [
  "individualHonours",
  "leagueTitles",
  "challengeCups",
];

export const ACHIEVEMENT_CATEGORY_TITLES: Record<
  AchievementCategoryId,
  string
> = {
  individualHonours: "Individual Honours",
  leagueTitles: "League Titles",
  challengeCups: "Challenge Cups",
};

export function getManOfSteelYears(playerId: string): number[] {
  return MOS_WINNERS[playerId] ?? [];
}

export function getDreamTeamYears(playerId: string): number[] {
  return DREAM_TEAM_YEARS[playerId] ?? [];
}

export function getGoldenBootYears(playerId: string): number[] {
  return GOLDEN_BOOT_YEARS[playerId] ?? [];
}

export function getLeagueLeadersYears(playerId: string): number[] {
  return LEAGUE_LEADERS_YEARS[playerId] ?? [];
}

export function getSuperLeagueChampionYears(playerId: string): number[] {
  return SUPER_LEAGUE_CHAMPION_YEARS[playerId] ?? [];
}

export function getChallengeCupYears(playerId: string): number[] {
  return CHALLENGE_CUP_YEARS[playerId] ?? [];
}

export function hasLanceToddTrophy(playerId: string): boolean {
  return LANCE_TODD_WINNERS.has(playerId);
}

export function hasDreamTeamSelection(playerId: string): boolean {
  return (DREAM_TEAM_YEARS[playerId]?.length ?? 0) > 0;
}

export function hasGoldenBootAward(playerId: string): boolean {
  return (GOLDEN_BOOT_YEARS[playerId]?.length ?? 0) > 0;
}

export function hasLeagueLeadersAward(playerId: string): boolean {
  return (LEAGUE_LEADERS_YEARS[playerId]?.length ?? 0) > 0;
}

export function getPlayerAchievements(
  player: Player,
  mode: AchievementDisplayMode = "compact"
): PlayerAchievement[] {
  return getPlayerAchievementGroups(player, mode).flatMap(
    (group) => group.achievements
  );
}

export function getPlayerAchievementGroups(
  player: Player,
  mode: AchievementDisplayMode = "compact"
): PlayerAchievementGroup[] {
  const byCategory = new Map<AchievementCategoryId, PlayerAchievement[]>();

  const push = (
    category: AchievementCategoryId,
    achievement: PlayerAchievement
  ) => {
    const list = byCategory.get(category) ?? [];
    list.push(achievement);
    byCategory.set(category, list);
  };

  for (const year of getManOfSteelYears(player.id)) {
    push("individualHonours", {
      label: `Man of Steel ${year}`,
      color: "green",
      category: "individualHonours",
    });
  }

  if (hasLanceToddTrophy(player.id)) {
    push("individualHonours", {
      label: "Lance Todd Trophy",
      color: "green",
      category: "individualHonours",
    });
  }

  const dreamYears =
    player.dreamTeamYears ?? getDreamTeamYears(player.id);
  if (dreamYears.length > 0) {
    push("individualHonours", {
      label: "Dream Team",
      color: "purple",
      category: "individualHonours",
      dreamTeamYears: dreamYears,
    });
  }

  const goldenYears =
    player.goldenBootYears ?? getGoldenBootYears(player.id);
  if (goldenYears.length > 0) {
    push("individualHonours", {
      label: "Golden Boot",
      color: "gold",
      category: "individualHonours",
      goldenBootYears: goldenYears,
    });
  }

  const leagueLeadersYears =
    player.leagueLeadersYears ?? getLeagueLeadersYears(player.id);
  if (leagueLeadersYears.length > 0) {
    push("leagueTitles", {
      label: "League Leaders",
      color: "silver",
      category: "leagueTitles",
      leagueLeadersYears,
    });
  }

  const championYears =
    player.superLeagueChampionYears ?? getSuperLeagueChampionYears(player.id);
  if (championYears.length > 0) {
    push("leagueTitles", {
      label: "Super League Champion",
      color: "green",
      category: "leagueTitles",
      superLeagueChampionYears: championYears,
    });
  } else if (player.superLeagueWinner) {
    push("leagueTitles", {
      label: "Super League Champion",
      color: "green",
      category: "leagueTitles",
    });
  }

  const challengeCupYears =
    player.challengeCupYears ?? getChallengeCupYears(player.id);
  if (challengeCupYears.length > 0) {
    push("challengeCups", {
      label: "Challenge Cup Winner",
      color: "gold",
      category: "challengeCups",
      challengeCupYears,
    });
  } else if (player.challengeCupWinner) {
    push("challengeCups", {
      label: "Challenge Cup Winner",
      color: "gold",
      category: "challengeCups",
    });
  }

  return ACHIEVEMENT_CATEGORY_ORDER.flatMap((category) => {
    const achievements = byCategory.get(category);
    if (!achievements?.length) return [];
    return [
      {
        category,
        title: ACHIEVEMENT_CATEGORY_TITLES[category],
        achievements,
      },
    ];
  });
}
