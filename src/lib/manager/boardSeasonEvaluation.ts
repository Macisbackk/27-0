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
} from "./leagueMembership";
import { getAutoPromoteCount } from "./managerLeagues";

/** Schema bump: pathway objectives always scored; confidence objective removed. */
export const BOARD_SACKING_SCHEMA_VERSION = 5;

export function buildBoardSeasonId(career: ManagerCareer): string {
  return `${career.club}-${career.seasonYear}`;
}

function expectationLabel(
  career: ManagerCareer,
  tier: ManagerClubExpectationTier
): string {
  return isUserInChampionship(career)
    ? CHAMPIONSHIP_EXPECTATION_LABELS[tier]
    : MANAGER_EXPECTATION_LABELS[tier];
}

type ObjStatus = BoardSeasonEvaluation["objectiveResults"][number]["status"];

function scoreFromStatus(status: ObjStatus): number {
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

/** Club-specific cup target — never a blanket "Win the Challenge Cup". */
function cupObjectiveForTier(
  tier: ManagerClubExpectationTier,
  cupLabel: string,
  isWinner: boolean,
  reachedSemi: boolean,
  reachedQuarter: boolean
): { status: ObjStatus; label: string } {
  if (tier === "title" || tier === "top") {
    if (isWinner) return { status: "achieved", label: "Win the Challenge Cup" };
    if (reachedSemi) {
      return { status: "partial", label: "Reach Challenge Cup semi-finals" };
    }
    return {
      status: "failed",
      label: "Reach Challenge Cup semi-finals",
    };
  }
  if (tier === "playoffs") {
    if (isWinner || reachedSemi) {
      return {
        status: "achieved",
        label: "Reach Challenge Cup quarter-finals",
      };
    }
    if (reachedQuarter) {
      return {
        status: "achieved",
        label: "Reach Challenge Cup quarter-finals",
      };
    }
    return {
      status: cupLabel.includes("Round") ? "partial" : "failed",
      label: "Reach Challenge Cup quarter-finals",
    };
  }
  if (tier === "mid-table") {
    if (isWinner || reachedSemi || reachedQuarter) {
      return { status: "achieved", label: "Progress in the Challenge Cup" };
    }
    if (
      cupLabel.includes("Round") ||
      cupLabel.includes("Last") ||
      cupLabel.includes("Sixteen")
    ) {
      return { status: "partial", label: "Progress in the Challenge Cup" };
    }
    return { status: "failed", label: "Progress in the Challenge Cup" };
  }
  // survive / avoid-bottom — modest cup ask
  if (isWinner || reachedSemi || reachedQuarter || cupLabel.includes("Round")) {
    return { status: "achieved", label: "Reach Challenge Cup second round" };
  }
  return { status: "failed", label: "Reach Challenge Cup second round" };
}

function leaguePathwayObjective(
  career: ManagerCareer,
  tier: ManagerClubExpectationTier,
  position: number,
  leagueSize: number
): BoardSeasonEvaluation["objectiveResults"][number] {
  const inChamp = isUserInChampionship(career);
  const promoted =
    inChamp &&
    (position <= getAutoPromoteCount() ||
      career.millionPoundGame?.winner === career.club);

  if (inChamp) {
    if (tier === "title" || tier === "top") {
      return {
        id: "playoffs",
        label: "Win automatic promotion",
        status: position === 1 ? "achieved" : promoted ? "partial" : "failed",
        weight: 25,
      };
    }
    if (tier === "playoffs") {
      const playoffPlace = position >= 2 && position <= 5;
      const reachedFinal =
        career.championshipPlayoffs?.tournamentComplete === true &&
        getChampionshipPlayoffUserInFinal(career);
      return {
        id: "playoffs",
        label: "Reach Championship play-off final",
        status: reachedFinal
          ? "achieved"
          : playoffPlace
            ? "partial"
            : "failed",
        weight: 25,
      };
    }
    return {
      id: "playoffs",
      label: "Finish in the top half",
      status:
        position <= Math.ceil(leagueSize / 2)
          ? "achieved"
          : position <= Math.ceil(leagueSize / 2) + 2
            ? "partial"
            : "failed",
      weight: 25,
    };
  }

  // Super League — label matches the actual target for this club tier.
  if (tier === "title") {
    const gf = career.playoffs?.finish === "Super League Champions";
    return {
      id: "playoffs",
      label: "Win the Grand Final",
      status: gf
        ? "achieved"
        : userQualifiedForManagerPlayoffs(career)
          ? "partial"
          : "failed",
      weight: 25,
    };
  }
  if (tier === "top") {
    return {
      id: "playoffs",
      label: "Finish in the top 4",
      status:
        position <= 4 ? "achieved" : position <= 6 ? "partial" : "failed",
      weight: 25,
    };
  }
  if (tier === "playoffs") {
    return {
      id: "playoffs",
      label: "Finish in the top 6",
      status:
        position <= 6 ? "achieved" : position <= 8 ? "partial" : "failed",
      weight: 25,
    };
  }
  if (tier === "mid-table") {
    return {
      id: "playoffs",
      label: "Finish in the top 8",
      status:
        position <= 8 ? "achieved" : position <= 10 ? "partial" : "failed",
      weight: 25,
    };
  }
  // survive / avoid-bottom
  const mpgPos = Math.max(1, leagueSize - 1);
  return {
    id: "playoffs",
    label: `Finish above ${mpgPos}${mpgPos === 1 ? "st" : mpgPos === 2 ? "nd" : mpgPos === 3 ? "rd" : "th"}`,
    status:
      position < mpgPos
        ? "achieved"
        : position === mpgPos
          ? "partial"
          : "failed",
    weight: 25,
  };
}

function getChampionshipPlayoffUserInFinal(career: ManagerCareer): boolean {
  const gf = career.championshipPlayoffs?.matches.find((m) => m.id === "gf");
  return Boolean(
    gf &&
      (gf.homeTeam === career.club || gf.awayTeam === career.club)
  );
}

/**
 * End-of-season board review. No sacking, no board-confidence objective.
 * Pathway labels always match the club tier and are scored against final position.
 */
export function evaluateBoardSeason(
  career: ManagerCareer
): BoardSeasonEvaluation {
  const summary = buildSeasonSummary(career);
  const tier = getCareerExpectationTier(career);
  const managerId = career.managerId ?? career.id;
  const seasonId = buildBoardSeasonId(career);
  const decisionId = `board-${seasonId}-${managerId}`;
  const labels = expectationLabel(career, tier);
  const leagueSize = getUserLeagueClubs(career).length;

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
  const cupReachedQuarter =
    cupReachedSemi || cupOutcome.label.includes("Quarter");

  const pathwayObjective = leaguePathwayObjective(
    career,
    tier,
    summary.position,
    leagueSize
  );

  const inChamp = isUserInChampionship(career);
  const cupObj =
    tier === "playoffs" && !inChamp
      ? {
          label: "Challenge Cup run",
          status: "na" as ObjStatus,
        }
      : cupObjectiveForTier(
          tier,
          cupOutcome.label,
          cupOutcome.isWinner,
          cupReachedSemi,
          cupReachedQuarter
        );

  const objectiveResults: BoardSeasonEvaluation["objectiveResults"] = [
    {
      id: "primary",
      label: career.boardExpectation || labels,
      status: primaryMet ? "achieved" : "failed",
      weight: 55,
    },
    pathwayObjective,
    {
      id: "cup",
      label: cupObj.label,
      status: cupObj.status,
      weight: cupObj.status === "na" ? 0 : 20,
    },
  ];

  const performanceScore = Math.round(
    (objectiveResults.reduce(
      (sum, obj) => sum + scoreFromStatus(obj.status) * obj.weight,
      0
    ) /
      objectiveResults.reduce((sum, obj) => sum + obj.weight, 0)) *
      100
  );

  const explanation: string[] = [];
  if (primaryMet) {
    explanation.push(`Primary target met: ${labels}.`);
  } else {
    explanation.push(
      `Primary target missed: ${labels} (finished ${summary.position}${
        summary.position === 1
          ? "st"
          : summary.position === 2
            ? "nd"
            : summary.position === 3
              ? "rd"
              : "th"
      }).`
    );
  }
  if (pathwayObjective.status === "achieved") {
    explanation.push(`League objective delivered: ${pathwayObjective.label}.`);
  } else if (pathwayObjective.status === "partial") {
    explanation.push(`Close on league objective: ${pathwayObjective.label}.`);
  }
  if (cupOutcome.isWinner) {
    explanation.push("Challenge Cup won.");
  } else if (cupReachedSemi) {
    explanation.push(`Cup run ended at ${cupOutcome.label}.`);
  }

  explanation.push("You continue as manager next season.");

  return {
    seasonId,
    clubId: career.club,
    managerId,
    objectiveResults,
    boardConfidence: career.boardConfidence ?? 50,
    performanceScore,
    recommendation: "retain",
    finalDecision: "retain",
    protectedByNoSacking: false,
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
    (career.boardSackingSchemaVersion ?? 0) >= BOARD_SACKING_SCHEMA_VERSION &&
    existing.finalDecision === "retain" &&
    !existing.objectiveResults.some((o) => o.id === "confidence") &&
    !existing.objectiveResults.some(
      (o) =>
        o.id === "playoffs" &&
        o.status === "na" &&
        o.label.toLowerCase().includes("top 6")
    )
  ) {
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

/** @deprecated Sacking removed — always false. */
export function wasManagerSacked(_career: ManagerCareer): boolean {
  return false;
}
