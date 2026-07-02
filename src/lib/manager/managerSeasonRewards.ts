import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import type { ClubFundsEarnedLine, ClubFundsPayoutResult } from "../club-funds";
import { formatClubFunds } from "../club-funds";
import { awardClubFundsLines } from "../storage/club-funds";
import type { ManagerCareer, ManagerSeasonSummary } from "./types";
import { getUserLeaguePosition } from "./managerFixtures";
import { getManagerClubConfig, didMeetManagerBoardExpectation } from "./club-config";

export function getManagerSeasonRewardRunId(career: ManagerCareer): string {
  return `manager-${career.id}-s${career.seasonYear}`;
}

export function computeManagerSeasonRewardLines(
  career: ManagerCareer,
  summary?: ManagerSeasonSummary
): ClubFundsEarnedLine[] {
  const lines: ClubFundsEarnedLine[] = [];
  const position =
    summary?.position ??
    getUserLeaguePosition(career.leagueTable, career.club);
  const wins = summary?.wins ?? career.wins;
  const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);
  const config = getManagerClubConfig(career.club);

  lines.push({
    id: "mgr-season-complete",
    label: "Season Completed",
    amount: 250_000,
  });

  if (wins > 0) {
    lines.push({
      id: "mgr-league-wins",
      label: `League Wins x${wins}`,
      amount: wins * 40_000,
    });
  }

  if (position <= 6) {
    lines.push({
      id: "mgr-top-six",
      label: "Top 6 Finish",
      amount: 500_000,
    });
  }

  if (position === 1 && !summary?.playoffFinish) {
    lines.push({
      id: "mgr-league-leaders",
      label: "League Leaders",
      amount: 1_250_000,
    });
  }

  const playoffFinish =
    summary?.playoffFinish ?? career.playoffs?.finish ?? null;
  if (playoffFinish === "Super League Champions") {
    lines.push({
      id: "mgr-playoff-champions",
      label: "Super League Champions",
      amount: 2_000_000,
    });
  } else if (playoffFinish === "Grand Final Runner-Up") {
    lines.push({
      id: "mgr-playoff-gf-runner-up",
      label: "Grand Final Runner-Up",
      amount: 900_000,
    });
  } else if (playoffFinish === "Eliminated in Semi-Final") {
    lines.push({
      id: "mgr-playoff-semi",
      label: "Play-Off Semi-Final",
      amount: 400_000,
    });
  } else if (playoffFinish === "Eliminated in Eliminator") {
    lines.push({
      id: "mgr-playoff-elim",
      label: "Play-Off Eliminator",
      amount: 200_000,
    });
  }

  const cupFinish = cupOutcome.finish;
  if (cupOutcome.isWinner) {
    lines.push({
      id: "mgr-cup-win",
      label: "Challenge Cup Winner",
      amount: 1_500_000,
    });
  } else if (cupFinish === "Runners-Up") {
    lines.push({
      id: "mgr-cup-runner-up",
      label: "Challenge Cup Runner-Up",
      amount: 750_000,
    });
  } else if (cupFinish === "Semi Final") {
    lines.push({
      id: "mgr-cup-semi",
      label: "Challenge Cup Semi-Final",
      amount: 500_000,
    });
  } else if (cupFinish === "Quarter Final") {
    lines.push({
      id: "mgr-cup-qf",
      label: "Challenge Cup Quarter-Final",
      amount: 250_000,
    });
  }

  const objectiveMet = didMeetManagerBoardExpectation(
    config.expectationTier,
    position,
    playoffFinish
  );

  if (objectiveMet) {
    lines.push({
      id: "mgr-board-objective",
      label: "Board Objective Met",
      amount: 500_000,
    });
  }

  const fanMood = career.attendanceData.fanMood;
  if (fanMood >= 65) {
    lines.push({
      id: "mgr-attendance-growth",
      label: "Strong Attendance Growth",
      amount: 250_000,
    });
  }

  return lines;
}

export function claimManagerSeasonRewards(
  career: ManagerCareer,
  summary?: ManagerSeasonSummary
): { payout: ClubFundsPayoutResult; career: ManagerCareer } {
  const runId = getManagerSeasonRewardRunId(career);
  const lines = computeManagerSeasonRewardLines(career, summary);
  const payout = awardClubFundsLines(runId, lines);

  return {
    payout,
    career: {
      ...career,
      seasonRewardClaimedForYear: payout.awarded
        ? career.seasonYear
        : career.seasonRewardClaimedForYear,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function isManagerSeasonRewardClaimed(career: ManagerCareer): boolean {
  return career.seasonRewardClaimedForYear === career.seasonYear;
}

export function formatRewardTotal(lines: ClubFundsEarnedLine[]): string {
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  return formatClubFunds(total);
}
