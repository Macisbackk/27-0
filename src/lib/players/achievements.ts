import type { Player } from "../types";
import manOfSteelWinners from "../../../data/man-of-steel-winners.json";
import lanceToddWinners from "../../../data/lance-todd-winners.json";
import dreamTeamYearsData from "../../../data/dream-team-years.json";
import goldenBootYearsData from "../../../data/golden-boot-years.json";

const MOS_WINNERS = manOfSteelWinners as Record<string, number[]>;
const LANCE_TODD_WINNERS = new Set(lanceToddWinners as string[]);
const DREAM_TEAM_YEARS = dreamTeamYearsData as Record<string, number[]>;
const GOLDEN_BOOT_YEARS = goldenBootYearsData as Record<string, number[]>;

export type AchievementCategoryId =
  | "individualHonours"
  | "leagueTitles"
  | "challengeCups";

export interface PlayerAchievement {
  label: string;
  color: "gold" | "green" | "purple" | "blue" | "silver";
  category: AchievementCategoryId;
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

export function hasLanceToddTrophy(playerId: string): boolean {
  return LANCE_TODD_WINNERS.has(playerId);
}

export function hasDreamTeamSelection(playerId: string): boolean {
  return (DREAM_TEAM_YEARS[playerId]?.length ?? 0) > 0;
}

export function hasGoldenBootAward(playerId: string): boolean {
  return (GOLDEN_BOOT_YEARS[playerId]?.length ?? 0) > 0;
}

export function getPlayerAchievements(player: Player): PlayerAchievement[] {
  return getPlayerAchievementGroups(player).flatMap((group) => group.achievements);
}

export function getPlayerAchievementGroups(
  player: Player
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

  if (hasDreamTeamSelection(player.id)) {
    push("individualHonours", {
      label: "Dream Team",
      color: "purple",
      category: "individualHonours",
    });
  }

  if (hasGoldenBootAward(player.id)) {
    push("individualHonours", {
      label: "Golden Boot Winner",
      color: "gold",
      category: "individualHonours",
    });
  }

  if (player.superLeagueWinner) {
    push("leagueTitles", {
      label: "Super League Champion",
      color: "green",
      category: "leagueTitles",
    });
  }

  if (player.challengeCupWinner) {
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
