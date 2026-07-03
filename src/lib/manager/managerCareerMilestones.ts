import { getManagerCareerSaveView } from "./managerCareerSaveStats";
import type { ManagerCareer } from "./types";

export interface ManagerMilestone {
  id: string;
  label: string;
  earned: boolean;
  detail?: string;
}

export function getManagerCareerMilestones(career: ManagerCareer): ManagerMilestone[] {
  const stats = getManagerCareerSaveView(career);
  const perfect = stats.perfectSeasons > 0;
  const cup = stats.challengeCups > 0;
  const league = stats.leagueTitles > 0;
  const sl = stats.superLeagueTitles > 0;
  const topSix = stats.topSixFinishes >= 3;
  const earnings = stats.totalEarnings >= 500_000;

  return [
    {
      id: "first-title",
      label: "Super League champions",
      earned: sl,
      detail: sl ? `${stats.superLeagueTitles} title${stats.superLeagueTitles === 1 ? "" : "s"}` : undefined,
    },
    {
      id: "league-leaders",
      label: "League leaders",
      earned: league,
      detail: league ? `${stats.leagueTitles} time${stats.leagueTitles === 1 ? "" : "s"}` : undefined,
    },
    {
      id: "challenge-cup",
      label: "Challenge Cup winner",
      earned: cup,
      detail: cup ? `${stats.challengeCups} cup${stats.challengeCups === 1 ? "" : "s"}` : undefined,
    },
    {
      id: "perfect-season",
      label: "Perfect 27-0 season",
      earned: perfect,
    },
    {
      id: "top-six-streak",
      label: "Regular top-six club",
      earned: topSix,
      detail: topSix ? `${stats.topSixFinishes} top-six finishes` : undefined,
    },
    {
      id: "club-legend",
      label: "£500k+ club earnings",
      earned: earnings,
    },
  ];
}

export function getManagerCareerHeadlines(career: ManagerCareer): string[] {
  const stats = getManagerCareerSaveView(career);
  const headlines: string[] = [];

  if (stats.superLeagueTitles > 0) {
    headlines.push(
      `${stats.superLeagueTitles} Super League title${stats.superLeagueTitles === 1 ? "" : "s"}`
    );
  }
  if (stats.leagueTitles > 0) {
    headlines.push(
      `${stats.leagueTitles} league title${stats.leagueTitles === 1 ? "" : "s"}`
    );
  }
  if (stats.challengeCups > 0) {
    headlines.push(
      `${stats.challengeCups} Challenge Cup${stats.challengeCups === 1 ? "" : "s"}`
    );
  }
  if (stats.bestFinishLabel && stats.bestFinish === 1) {
    headlines.push("Finished 1st in the league table");
  }
  if (stats.biggestWinMargin > 0) {
    headlines.push(`Biggest win +${stats.biggestWinMargin}`);
  }
  if (stats.perfectSeasons > 0) {
    headlines.push(`${stats.perfectSeasons} perfect season${stats.perfectSeasons === 1 ? "" : "s"}`);
  }
  if (headlines.length === 0 && stats.completedSeasons > 0) {
    headlines.push(`${stats.totalRecordLabel} career record`);
  }

  return headlines.slice(0, 5);
}
