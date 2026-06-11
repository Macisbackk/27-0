import type { Player } from "../types";
import manOfSteelWinners from "../../../data/man-of-steel-winners.json";

const MOS_WINNERS = manOfSteelWinners as Record<string, number[]>;

export type AchievementCategoryId =
  | "hallOfFameLegend"
  | "individualHonours"
  | "leagueTitles"
  | "challengeCups"
  | "clubHonours";

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
  "hallOfFameLegend",
  "individualHonours",
  "leagueTitles",
  "challengeCups",
  "clubHonours",
];

export const ACHIEVEMENT_CATEGORY_TITLES: Record<
  AchievementCategoryId,
  string
> = {
  hallOfFameLegend: "Hall of Fame / Legend",
  individualHonours: "Individual Honours",
  leagueTitles: "League Titles",
  challengeCups: "Challenge Cups",
  clubHonours: "Club Honours",
};

export function getManOfSteelYears(playerId: string): number[] {
  return MOS_WINNERS[playerId] ?? [];
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

  if (player.category === "legend") {
    push("hallOfFameLegend", {
      label: "Legend",
      color: "gold",
      category: "hallOfFameLegend",
    });
  }

  for (const year of getManOfSteelYears(player.id)) {
    push("individualHonours", {
      label: `Man of Steel ${year}`,
      color: "green",
      category: "individualHonours",
    });
  }

  if (player.lanceToddTrophy) {
    push("individualHonours", {
      label: "Lance Todd Trophy",
      color: "green",
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

  if (player.clubLegend) {
    push("clubHonours", {
      label: "Club Hero",
      color: "gold",
      category: "clubHonours",
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
