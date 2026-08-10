import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import {
  didMeetManagerBoardExpectation,
  MANAGER_EXPECTATION_LABELS,
  CHAMPIONSHIP_EXPECTATION_LABELS,
  type ManagerClubExpectationTier,
} from "./club-config";
import { buildSeasonSummary } from "./managerStateSeason";
import { getCareerExpectationTier } from "./managerDifficulty";
import { userQualifiedForManagerPlayoffs } from "./managerPlayoffs";
import type { BoardSeasonEvaluation, ManagerCareer } from "./types";
import {
  getUserCompetitionId,
  getUserLeagueClubs,
  isUserInChampionship,
  PROMOTE_RELEGATE_COUNT,
} from "./leagueMembership";

export const BOARD_SACKING_SCHEMA_VERSION = 2;

export function buildBoardSeasonId(career: ManagerCareer): string {
  return `${career.club}-${career.seasonYear}`;
}

function isTerriblePositionForTier(
  tier: ManagerClubExpectationTier,
  position: number,
  size: number
): boolean {
  switch (tier) {
    case "title":
    case "top":
      return position > Math.max(8, Math.floor(size * 0.7));
    case "playoffs":
      return position >= Math.max(10, size - 4);
    case "mid-table":
    case "avoid-bottom":
    case "survive":
      return position >= size - 1;
  }
}

function cupObjectiveStatus(
  cupLabel: string,
  isWinner: boolean,
  reachedSemi: boolean
): { status: BoardSeasonEvaluation["objectiveResults"][number]["status"]; label: string } {
  if (isWinner) {
    return { status: "achieved", label: "Win the Challenge Cup" };
  }
  if (reachedSemi) {
    return { status: "partial", label: "Reach Challenge Cup semi-finals" };
  }
  if (cupLabel.includes("Quarter") || cupLabel.includes("Semi")) {
    return { status: "partial", label: "Reach Challenge Cup quarter-finals" };
  }
  return { status: "failed", label: "Progress in the Challenge Cup" };
}

function scoreFromStatus(
  status: BoardSeasonEvaluation["objectiveResults"][number]["status"]
): number {
  switch (status) {
    case "achieved":
      return 1;
    case "partial":
      return 0.5;
    case "failed":
      return 0;
    case "na":
      return 0.5;
  }
}

function expectationLabel(
  career: ManagerCareer,
  tier: ManagerClubExpectationTier
): string {
  return isUserInChampionship(career)
    ? CHAMPIONSHIP_EXPECTATION_LABELS[tier]
    : MANAGER_EXPECTATION_LABELS[tier];
}

function championshipPathwayObjective(
  tier: ManagerClubExpectationTier,
  position: number
): BoardSeasonEvaluation["objectiveResults"][number] {
  const promoted = position <= PROMOTE_RELEGATE_COUNT;
  const topFour = position <= 4;

  if (tier === "title" || tier === "top") {
    return {
      id: "playoffs",
      label: "Earn promotion (top 2)",
      status: promoted ? "achieved" : topFour ? "partial" : "failed",
      weight: 20,
    };
  }
  if (tier === "playoffs") {
    return {
      id: "playoffs",
      label: "Finish top four",
      status: topFour ? "achieved" : position <= 6 ? "partial" : "failed",
      weight: 20,
    };
  }
  return {
    id: "playoffs",
    label: "Earn promotion (top 2)",
    status: promoted ? "achieved" : "na",
    weight: 20,
  };
}

export function evaluateBoardSeason(
  career: ManagerCareer
): BoardSeasonEvaluation {
  const summary = buildSeasonSummary(career);
  const tier = getCareerExpectationTier(career);
  const managerId = career.managerId ?? career.id;
  const seasonId = buildBoardSeasonId(career);
  const decisionId = `board-${seasonId}-${managerId}`;
  const inChamp = isUserInChampionship(career);
  const labels = expectationLabel(career, tier);

  const primaryMet = didMeetManagerBoardExpectation(
    tier,
    summary.position,
    summary.playoffFinish ?? null,
    getUserCompetitionId(career)
  );

  const cupOutcome = deriveCupOutcomeFromBracket(career.challengeCup);
  const cupReachedSemi =
    cupOutcome.label.includes("Semi") ||
    cupOutcome.label.includes("Final") ||
    cupOutcome.isWinner;

  const cupObj = cupObjectiveStatus(
    cupOutcome.label,
    cupOutcome.isWinner,
    cupReachedSemi
  );

  const playoffMet =
    tier === "title"
      ? summary.playoffFinish === "Super League Champions"
      : userQualifiedForManagerPlayoffs(career) && summary.position <= 6;

  const pathwayObjective = inChamp
    ? championshipPathwayObjective(tier, summary.position)
    : {
        id: "playoffs" as const,
        label:
          tier === "title"
            ? "Win the Grand Final"
            : "Finish in the top six",
        status:
          tier === "mid-table" || tier === "avoid-bottom" || tier === "survive"
            ? ("na" as const)
            : playoffMet
              ? ("achieved" as const)
              : summary.position <= 8
                ? ("partial" as const)
                : ("failed" as const),
        weight: 20,
      };

  const objectiveResults: BoardSeasonEvaluation["objectiveResults"] = [
    {
      id: "primary",
      label: career.boardExpectation || labels,
      status: primaryMet ? "achieved" : "failed",
      weight: 60,
    },
    pathwayObjective,
    {
      id: "cup",
      label: cupObj.label,
      status: cupObj.status,
      weight: 10,
    },
    {
      id: "confidence",
      label: `Maintain board confidence (${career.boardConfidence}%)`,
      status:
        career.boardConfidence >= 60
          ? "achieved"
          : career.boardConfidence >= 40
            ? "partial"
            : "failed",
      weight: 10,
    },
  ];

  const performanceScore = Math.round(
    objectiveResults.reduce(
      (sum, obj) => sum + scoreFromStatus(obj.status) * obj.weight,
      0
    )
  );

  const terriblePosition = isTerriblePositionForTier(
    tier,
    summary.position,
    getUserLeagueClubs(career).length
  );
  const explanation: string[] = [];

  if (primaryMet) {
    explanation.push(`Primary target met: ${labels}.`);
  } else {
    explanation.push(
      `Primary target missed: ${labels} (finished ${summary.position}${summary.position === 1 ? "st" : summary.position === 2 ? "nd" : summary.position === 3 ? "rd" : "th"}).`
    );
  }

  if (inChamp && summary.position <= PROMOTE_RELEGATE_COUNT) {
    explanation.push("Promoted to Super League.");
  } else if (inChamp && pathwayObjective.status === "partial") {
    explanation.push("Close to the promotion places.");
  }

  if (cupOutcome.isWinner) {
    explanation.push("Challenge Cup won — a major positive for the board.");
  } else if (cupReachedSemi) {
    explanation.push(`Cup run ended at ${cupOutcome.label}.`);
  }

  explanation.push(`Board confidence stands at ${career.boardConfidence}%.`);

  let recommendation: "retain" | "sack" = "retain";

  if (primaryMet) {
    explanation.push(
      "Primary objective delivered — the board will retain you."
    );
  } else if (career.boardConfidence < 30) {
    recommendation = "sack";
    explanation.push(
      "Confidence below 30% with the primary target missed."
    );
  } else if (career.boardConfidence < 50 || terriblePosition) {
    recommendation = "sack";
    if (career.boardConfidence < 50) {
      explanation.push(
        "Confidence below 50% with the primary target missed."
      );
    }
    if (terriblePosition) {
      explanation.push(
        `League position (${summary.position}${summary.position === 1 ? "st" : summary.position === 2 ? "nd" : summary.position === 3 ? "rd" : "th"}) is unacceptable for a ${tier} club.`
      );
    }
  } else {
    explanation.push(
      "The board are disappointed but will offer another season."
    );
  }

  const protectedByNoSacking = career.managerProtection?.noSacking === true;
  const finalDecision = protectedByNoSacking ? "retain" : recommendation;

  if (protectedByNoSacking && recommendation === "sack") {
    explanation.push(
      "Sacking protection is active — the board cannot dismiss you this season."
    );
  }

  return {
    seasonId,
    clubId: career.club,
    managerId,
    objectiveResults,
    boardConfidence: career.boardConfidence,
    performanceScore,
    recommendation,
    finalDecision,
    protectedByNoSacking,
    explanation,
    decisionId,
  };
}

export function getOrCreateBoardSeasonEvaluation(career: ManagerCareer): {
  career: ManagerCareer;
  evaluation: BoardSeasonEvaluation;
} {
  const seasonId = buildBoardSeasonId(career);
  const existing =
    career.boardSeasonEvaluations?.[seasonId] ?? career.boardSeasonEvaluation;

  if (
    existing &&
    existing.seasonId === seasonId &&
    existing.clubId === career.club &&
    (career.boardSackingSchemaVersion ?? 0) >= BOARD_SACKING_SCHEMA_VERSION
  ) {
    // Re-evaluate if no-sacking was activated after a stale sack decision.
    if (
      career.managerProtection?.noSacking &&
      existing.finalDecision === "sack"
    ) {
      // fall through to recompute
    } else {
      return { career, evaluation: existing };
    }
  }

  const evaluation = evaluateBoardSeason(career);
  const boardSeasonEvaluations = {
    ...(career.boardSeasonEvaluations ?? {}),
    [seasonId]: evaluation,
  };

  return {
    career: {
      ...career,
      boardSeasonEvaluation: evaluation,
      boardSeasonEvaluations,
      boardSackingSchemaVersion: BOARD_SACKING_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    },
    evaluation,
  };
}

/** Drop cached board eval for the current season (e.g. after no-sacking boost). */
export function invalidateBoardSeasonEvaluation(
  career: ManagerCareer
): ManagerCareer {
  const seasonId = buildBoardSeasonId(career);
  const nextEvals = { ...(career.boardSeasonEvaluations ?? {}) };
  delete nextEvals[seasonId];
  return {
    ...career,
    boardSeasonEvaluation:
      career.boardSeasonEvaluation?.seasonId === seasonId
        ? undefined
        : career.boardSeasonEvaluation,
    boardSeasonEvaluations: nextEvals,
    updatedAt: new Date().toISOString(),
  };
}

export function wasManagerSacked(career: ManagerCareer): boolean {
  const evaluation =
    career.boardSeasonEvaluation ??
    career.boardSeasonEvaluations?.[buildBoardSeasonId(career)];
  return evaluation?.finalDecision === "sack";
}
