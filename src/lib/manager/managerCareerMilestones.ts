import { getManagerCareerSaveView } from "./managerCareerSaveStats";
import {
  getManagerSeasonTrophyLabels,
  getSeasonSummaryTrophyLabels,
} from "./managerSeasonTrophies";
import { shouldScheduleWorldClubChallenge } from "./worldClubChallenge";
import type { ManagerCareer } from "./types";

export interface ManagerMilestone {
  id: string;
  label: string;
  earned: boolean;
  detail?: string;
}

const MAJOR_TROPHY_LABELS = [
  "League Leaders",
  "Super League Champions",
  "Challenge Cup",
  "World Club Challenge",
] as const;

function majorTrophyCount(labels: string[]): number {
  return labels.filter((label) =>
    (MAJOR_TROPHY_LABELS as readonly string[]).includes(label)
  ).length;
}

function majorTrophiesWon(labels: string[]): string[] {
  return labels.filter((label) =>
    (MAJOR_TROPHY_LABELS as readonly string[]).includes(label)
  );
}

function seasonHasCleanSweep(
  labels: string[],
  wccAvailable: boolean
): boolean {
  const won = majorTrophiesWon(labels);
  const available = [
    "League Leaders",
    "Super League Champions",
    "Challenge Cup",
    ...(wccAvailable ? ["World Club Challenge"] : []),
  ];
  return available.every((label) => won.includes(label));
}

function careerHasMajorTrophyCount(
  career: ManagerCareer,
  minCount: number
): boolean {
  if (majorTrophyCount(getManagerSeasonTrophyLabels(career)) >= minCount) {
    return true;
  }
  return career.seasonHistory.some(
    (season) =>
      majorTrophyCount(getSeasonSummaryTrophyLabels(season)) >= minCount
  );
}

function careerHasCleanSweep(career: ManagerCareer): boolean {
  if (
    seasonHasCleanSweep(
      getManagerSeasonTrophyLabels(career),
      shouldScheduleWorldClubChallenge(career)
    )
  ) {
    return true;
  }
  return career.seasonHistory.some((season) =>
    seasonHasCleanSweep(
      getSeasonSummaryTrophyLabels(season),
      true
    )
  );
}

function careerHasWorldClubChallengeWin(career: ManagerCareer): boolean {
  if (
    majorTrophiesWon(getManagerSeasonTrophyLabels(career)).includes(
      "World Club Challenge"
    )
  ) {
    return true;
  }
  return (
    (career.worldClubChallenge?.history ?? []).some(
      (result) => result.userResult === "won"
    ) ||
    career.seasonHistory.some((season) =>
      getSeasonSummaryTrophyLabels(season).includes("World Club Challenge")
    )
  );
}

function careerHasPerfectTrophySeason(career: ManagerCareer): boolean {
  if (
    career.losses === 0 &&
    career.wins > 0 &&
    seasonHasCleanSweep(
      getManagerSeasonTrophyLabels(career),
      shouldScheduleWorldClubChallenge(career)
    )
  ) {
    return true;
  }
  return career.seasonHistory.some((season, index) => {
    if (season.losses !== 0 || season.wins <= 0) return false;
    return seasonHasCleanSweep(
      getSeasonSummaryTrophyLabels(season),
      index >= 1 ||
        getSeasonSummaryTrophyLabels(season).includes("World Club Challenge")
    );
  });
}

export function getManagerCareerMilestones(career: ManagerCareer): ManagerMilestone[] {
  const stats = getManagerCareerSaveView(career);
  const perfect = stats.perfectSeasons > 0;
  const cup = stats.challengeCups > 0;
  const league = stats.leagueTitles > 0;
  const sl = stats.superLeagueTitles > 0;
  const topSix = stats.topSixFinishes >= 3;
  const earnings = stats.totalEarnings >= 500_000;
  const treble = careerHasMajorTrophyCount(career, 3);
  const quadruple = careerHasMajorTrophyCount(career, 4);
  const cleanSweep = careerHasCleanSweep(career);
  const worldChampions = careerHasWorldClubChallengeWin(career);
  const perfectTrophy = careerHasPerfectTrophySeason(career);

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
      id: "world-champions",
      label: "World Club Challenge winners",
      earned: worldChampions,
    },
    {
      id: "treble-winners",
      label: "Treble winners",
      earned: treble,
    },
    {
      id: "quadruple-winners",
      label: "Quadruple winners",
      earned: quadruple,
    },
    {
      id: "clean-sweep",
      label: "Clean sweep",
      earned: cleanSweep,
    },
    {
      id: "perfect-trophy-season",
      label: "Perfect trophy season",
      earned: perfectTrophy,
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
  if (careerHasWorldClubChallengeWin(career)) {
    headlines.push("World Club Challenge winners");
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
