/**
 * Safe Manager Mode rebuild migration.
 * Never resets ratings, potential, histories, currency, or achievements.
 */
import type { ManagerCareer } from "./types";
import { MANAGER_SAVE_VERSION } from "./managerSaveVersion";
import { syncCompetitionPhase } from "./competitionPhase";
import { BOARD_SACKING_SCHEMA_VERSION } from "./boardSeasonEvaluation";

export const MANAGER_REBUILD_SAVE_VERSION = 3;

function normalizeLoans(career: ManagerCareer): ManagerCareer {
  const activeLoans = (career.activeLoans ?? []).map((loan) => ({
    ...loan,
    parentClubId: loan.parentClubId ?? loan.parentClub,
    loanClubId: loan.loanClubId ?? loan.loaneeClub,
    startDate:
      loan.startDate ??
      `${career.seasonYear}-W${Math.max(0, career.gameWeek - 1)}`,
    endDate: loan.endDate ?? `${loan.endsAtSeasonYear}-end`,
    status: loan.status ?? "active",
  }));
  if (activeLoans.length === 0 && !career.activeLoans) return career;
  return { ...career, activeLoans };
}

export function migrateManagerRebuildSave(career: ManagerCareer): ManagerCareer {
  let next = career;

  if (!Array.isArray(next.transferWatchlistIds)) {
    next = { ...next, transferWatchlistIds: [] };
  }

  if (next.managerProtection?.noSacking) {
    next = { ...next, managerProtection: { ...next.managerProtection, noSacking: false } };
  }

  if (next.boardSeasonEvaluation?.finalDecision === "sack") {
    next = {
      ...next,
      boardSeasonEvaluation: {
        ...next.boardSeasonEvaluation,
        recommendation: "retain",
        finalDecision: "retain",
        protectedByNoSacking: false,
      },
    };
  }

  const evals = { ...(next.boardSeasonEvaluations ?? {}) };
  let evalsChanged = false;
  for (const [id, evaluation] of Object.entries(evals)) {
    if (evaluation.finalDecision === "sack") {
      evals[id] = {
        ...evaluation,
        recommendation: "retain",
        finalDecision: "retain",
        protectedByNoSacking: false,
      };
      evalsChanged = true;
    }
  }
  if (evalsChanged) {
    next = { ...next, boardSeasonEvaluations: evals };
  }

  next = normalizeLoans(next);
  next = {
    ...next,
    boardSackingSchemaVersion: Math.max(
      next.boardSackingSchemaVersion ?? 0,
      BOARD_SACKING_SCHEMA_VERSION
    ),
    saveVersion: Math.max(next.saveVersion ?? 0, MANAGER_SAVE_VERSION),
  };
  return syncCompetitionPhase(next);
}
