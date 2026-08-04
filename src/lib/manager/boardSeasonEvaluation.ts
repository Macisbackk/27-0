import { deriveCupOutcomeFromBracket } from "../game/challenge-cup-bracket";
import {
  didMeetManagerBoardExpectation,
  MANAGER_EXPECTATION_LABELS,
  type ManagerClubExpectationTier,
} from "./club-config";
import { buildSeasonSummary } from "./managerStateSeason";
import { getCareerExpectationTier } from "./managerDifficulty";
import { userQualifiedForManagerPlayoffs } from "./managerPlayoffs";
import type { BoardSeasonEvaluation, ManagerCareer } from "./types";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";

export const BOARD_SACKING_SCHEMA_VERSION = 1;

const LEAGUE_SIZE = CURRENT_PLAYABLE_CLUBS.length;

export function buildBoardSeasonId(career: ManagerCareer): string {
  return `${career.club}-${career.seasonYear}`;
}

function isTerriblePositionForTier(
  tier: ManagerClubExpectationTier,
  position: number
): boolean {
  switch (tier) {
    case "title":
    case "top":
      return position > 10;
    case "playoffs":
      return position >= 13;
    case "mid-table":
    case "avoid-bottom":
    case "survive":
      return position >= LEAGUE_SIZE - 1;
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

export function evaluateBoardSeason(
  career: ManagerCareer
): BoardSeasonEvaluation {
  const summary = buildSeasonSummary(career);
  const tier = getCareerExpectationTier(career);
  const managerId = career.managerId ?? career.id;
  const seasonId = buildBoardSeasonId(career);
  const decisionId = `board-${seasonId}-${managerId}`;

  const primaryMet = didMeetManagerBoardExpectation(
    tier,
    summary.position,
    summary.playoffFinish ?? null
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

  const objectiveResults: BoardSeasonEvaluation["objectiveResults"] = [
    {
      id: "primary",
      label: career.boardExpectation,
      status: primaryMet ? "achieved" : "failed",
      weight: 60,
    },
    {
      id: "playoffs",
      label:
        tier === "title"
          ? "Win the Grand Final"
          : "Finish in the top six",
      status:
        tier === "mid-table" || tier === "avoid-bottom" || tier === "survive"
          ? "na"
          : playoffMet
            ? "achieved"
            : summary.position <= 8
              ? "partial"
              : "failed",
      weight: 20,
    },
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

  const terriblePosition = isTerriblePositionForTier(tier, summary.position);
  const explanation: string[] = [];

  if (primaryMet) {
    explanation.push(
      `Primary target met: ${MANAGER_EXPECTATION_LABELS[tier]}.`
    );
  } else {
    explanation.push(
      `Primary target missed: ${MANAGER_EXPECTATION_LABELS[tier]} was not achieved (finished ${summary.position}${summary.position === 1 ? "st" : summary.position === 2 ? "nd" : summary.position === 3 ? "rd" : "th"}).`
    );
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
      "The primary objective was delivered — the board will not dismiss you over secondary shortfalls."
    );
  } else if (career.boardConfidence < 25) {
    recommendation = "sack";
    explanation.push(
      "Confidence has collapsed below 25% with the primary target missed."
    );
  } else if (
    career.boardConfidence < 40 ||
    terriblePosition
  ) {
    recommendation = "sack";
    if (career.boardConfidence < 40) {
      explanation.push(
        "Confidence is below 40% with the primary target missed."
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

  if (existing && existing.seasonId === seasonId && existing.clubId === career.club) {
    return { career, evaluation: existing };
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

export function wasManagerSacked(career: ManagerCareer): boolean {
  const evaluation =
    career.boardSeasonEvaluation ??
    career.boardSeasonEvaluations?.[buildBoardSeasonId(career)];
  return evaluation?.finalDecision === "sack";
}
