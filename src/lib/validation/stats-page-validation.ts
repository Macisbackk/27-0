import type { UserStatsData } from "../types";
import {
  getChallengeCupView,
  getDraftModeView,
  getHardDraftModeView,
  getHardModeView,
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
}): string[] {
  const { normal, hard, draftNormal, draftHard } = input;
  const issues: string[] = [];

  const overall = getOverallView(normal, hard, draftNormal, draftHard);
  const seasonRunSum =
    normal.totalSeasonsSimulated +
    hard.totalSeasonsSimulated +
    draftNormal.totalSeasonsSimulated +
    draftHard.totalSeasonsSimulated;

  const visibleModeRuns =
    normal.totalRuns +
    hard.totalRuns +
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
    draftNormal.totalWinlessSeasons +
    draftHard.totalWinlessSeasons;
  if (overall.winlessSeasons !== winlessSum) {
    issues.push(
      `Overall 0-27 count (${overall.winlessSeasons}) ≠ sum of mode winless seasons (${winlessSum})`
    );
  }

  const cupView = getChallengeCupView(normal, hard);
  const appearances = normal.challengeCupRuns + hard.challengeCupRuns;
  if (cupView.runs !== appearances) {
    issues.push(
      `Cup appearances (${cupView.runs}) ≠ challengeCupRuns sum (${appearances})`
    );
  }
  const trophies = normal.challengeCupsWon + hard.challengeCupsWon;
  if (cupView.cupsWon !== trophies) {
    issues.push(
      `Cup trophies (${cupView.cupsWon}) ≠ challengeCupsWon sum (${trophies})`
    );
  }
  const matchWins = normal.challengeCupWins + hard.challengeCupWins;
  if (cupView.wins !== matchWins) {
    issues.push(
      `Cup match wins (${cupView.wins}) ≠ challengeCupWins sum (${matchWins})`
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

  const hardView = getHardModeView(hard);
  const hardSeasonPct = formatWinPercentage(hard.seasonWins, hard.seasonLosses);
  if (hardView.winPercentage !== hardSeasonPct) {
    issues.push(
      `Hard mode win % (${hardView.winPercentage}) should use season-only W/L`
    );
  }

  const slView = getSuperLeagueView(normal);
  if (slView.runs !== normal.totalSeasonsSimulated) {
    issues.push("Normal mode runs mismatch with totalSeasonsSimulated");
  }

  if (overall.totalRuns < visibleModeRuns - normal.challengeCupRuns - hard.challengeCupRuns) {
    // totalRuns in overall includes draft seasons as totalSeasonsSimulated — sanity only
  }

  return issues;
}

export function runStatsPageValidation(
  input: Parameters<typeof validateStatsPageStats>[0]
): void {
  const issues = validateStatsPageStats(input);
  devWarnMany("stats-page", issues);
}
