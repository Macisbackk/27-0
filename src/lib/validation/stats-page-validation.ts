import type { UserStatsData } from "../types";
import { EMPTY_STATS } from "../storage/stats";
import {
  getDraftModeView,
  getHardDraftModeView,
  getHardNormalModeView,
  getOverallView,
  getSuperLeagueView,
  formatWinPercentage,
} from "../stats-views";
import { devWarnMany } from "./dev-warn";

export function validateStatsPageStats(input: {
  normal: UserStatsData;
  hard: UserStatsData;
  draftNormal: UserStatsData;
  draftHard: UserStatsData;
  eraNormal?: UserStatsData;
}): string[] {
  const { normal, hard, draftNormal, draftHard, eraNormal } = input;
  const era = eraNormal ?? EMPTY_STATS;
  const issues: string[] = [];

  const overall = getOverallView(normal, hard, draftNormal, draftHard, era);
  const seasonRunSum =
    normal.totalSeasonsSimulated +
    hard.totalSeasonsSimulated +
    era.totalSeasonsSimulated +
    draftNormal.totalSeasonsSimulated +
    draftHard.totalSeasonsSimulated;

  if (overall.totalSeasons !== seasonRunSum) {
    issues.push(
      `Overall total seasons (${overall.totalSeasons}) ≠ sum of mode seasons (${seasonRunSum})`
    );
  }

  const computedWinPct = formatWinPercentage(
    overall.totalWins,
    overall.totalLosses
  );
  if (overall.totalWins + overall.totalLosses > 0) {
    const expected = Math.round(
      (overall.totalWins / (overall.totalWins + overall.totalLosses)) * 100
    );
    if (computedWinPct !== null && computedWinPct !== expected) {
      issues.push(
        `Overall win % helper (${computedWinPct}) ≠ wins/(wins+losses) (${expected})`
      );
    }
  }

  const perfectSum =
    normal.totalPerfectSeasons +
    hard.totalPerfectSeasons +
    era.totalPerfectSeasons +
    draftNormal.totalPerfectSeasons +
    draftHard.totalPerfectSeasons;
  if (overall.perfectSeasons !== perfectSum) {
    issues.push(
      `Overall 27-0 count (${overall.perfectSeasons}) ≠ sum of mode perfect seasons (${perfectSum})`
    );
  }

  const winlessSum =
    normal.totalWinlessSeasons +
    hard.totalWinlessSeasons +
    era.totalWinlessSeasons +
    draftNormal.totalWinlessSeasons +
    draftHard.totalWinlessSeasons;
  if (overall.winlessSeasons !== winlessSum) {
    issues.push(
      `Overall 0-27 count (${overall.winlessSeasons}) ≠ sum of mode winless seasons (${winlessSum})`
    );
  }

  for (const [label, stats] of [
    ["normal", normal],
    ["hard", hard],
    ["draft-normal", draftNormal],
    ["draft-hard", draftHard],
  ] as const) {
    const w = stats.seasonWins;
    const l = stats.seasonLosses;
    if (w + l > stats.totalSeasonsSimulated * 27) {
      issues.push(
        `${label}: season W+L (${w + l}) exceeds plausible games for ${stats.totalSeasonsSimulated} seasons`
      );
    }
  }

  const draftView = getDraftModeView(draftNormal);
  const hardDraftView = getHardDraftModeView(draftHard);
  if (draftView.runs !== draftNormal.totalSeasonsSimulated) {
    issues.push("Draft normal runs mismatch");
  }
  if (hardDraftView.runs !== draftHard.totalSeasonsSimulated) {
    issues.push("Draft hard runs mismatch");
  }

  const hardNormalView = getHardNormalModeView(hard);
  if (hardNormalView.runs !== hard.totalSeasonsSimulated) {
    issues.push("Hard normal mode runs mismatch with totalSeasonsSimulated");
  }

  const slView = getSuperLeagueView(normal);
  if (slView.runs !== normal.totalSeasonsSimulated) {
    issues.push("Normal mode runs mismatch with totalSeasonsSimulated");
  }

  return issues;
}

export function runStatsPageValidation(
  input: Parameters<typeof validateStatsPageStats>[0]
): void {
  const issues = validateStatsPageStats(input);
  devWarnMany("stats-page", issues);
}
