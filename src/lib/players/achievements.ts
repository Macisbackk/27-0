import type { Player } from "../types";

export interface PlayerAchievement {
  label: string;
  color: "gold" | "green" | "purple" | "blue" | "silver";
}

export function getPlayerAchievements(player: Player): PlayerAchievement[] {
  const achievements: PlayerAchievement[] = [];

  if (player.clubLegend) {
    achievements.push({ label: "Club Legend", color: "gold" });
  }
  if (player.hallOfFame) {
    achievements.push({ label: "Hall of Fame", color: "purple" });
  }
  if (player.manOfSteel) {
    achievements.push({ label: "Man of Steel", color: "green" });
  }
  if (player.challengeCupWinner) {
    achievements.push({ label: "Challenge Cup Winner", color: "gold" });
  }
  if (player.superLeagueWinner) {
    achievements.push({ label: "Grand Final Winner", color: "green" });
  }
  if (player.intlCaps > 0) {
    achievements.push({ label: "International Representative", color: "blue" });
  }

  return achievements;
}
