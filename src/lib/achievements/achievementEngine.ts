import {
  ACHIEVEMENT_DEFINITIONS,
  getAchievementDefinition,
  type AchievementDefinition,
} from "./achievementDefinitions";
import {
  buildAchievementProgress,
  type AchievementCheckContext,
  type AchievementProgressSnapshot,
} from "./achievementContext";
import {
  getUnlockedAchievement,
  isAchievementUnlocked,
  loadAchievements,
  saveAchievements,
  type UnlockedAchievement,
} from "./achievementStorage";
import { awardClubFundsLines } from "../storage/club-funds";

export type AchievementUnlockResult = {
  id: string;
  definition: AchievementDefinition;
  unlockedAt: string;
  rewardAmount?: number;
};

function evaluateUnlock(
  def: AchievementDefinition,
  ctx: AchievementCheckContext,
  progress: AchievementProgressSnapshot
): boolean {
  switch (def.id) {
    case "first-win":
      return progress.totalWins >= 1 || ctx.matchWon === true;
    case "winning-habit":
      return (ctx.seasonWins ?? progress.seasonWinsCurrent) >= 10;
    case "chaser-27-0":
      return (ctx.seasonWins ?? progress.seasonWinsCurrent) >= 20;
    case "perfect-season":
      return ctx.isPerfectSeason === true;
    case "unbeaten-again":
      return progress.unbeatenSeasons >= 3 || ctx.isUnbeatenSeason === true;
    case "elite-builder":
      return ctx.squadGrade === "S" || ctx.squadGrade === "S+";
    case "underdog-run":
      return ctx.madePlayoffs === true && ctx.lowRatedSquad === true;
    case "bradford-bias":
      return (
        (ctx.bradfordPlayerCount ?? 0) >= 5 && ctx.winningRecord === true
      );
    case "cup-debut":
      return ctx.cupPlayed === true;
    case "cup-finalist":
      return ctx.cupFinalReached === true || progress.cupFinals >= 1;
    case "cup-winners":
      return ctx.cupWon === true || progress.challengeCupsWon >= 1;
    case "era-cup-kings":
      return ctx.cupWon === true && ctx.eraCup === true;
    case "giant-killer":
      return ctx.beatStrongerTeam === true;
    case "cup-dynasty":
      return progress.challengeCupsWon >= 5;
    case "first-day-job":
      return (
        ctx.managerCareerStarted === true || progress.managerCareersStarted >= 1
      );
    case "first-manager-win":
      return ctx.managerWin === true || progress.managerWins >= 1;
    case "safe-pair-hands":
      return (
        ctx.managerSeasonComplete === true &&
        (ctx.managerFinishPosition ?? 99) < 12
      );
    case "playoff-coach":
      return (
        ctx.managerSeasonComplete === true &&
        (ctx.managerFinishPosition ?? 99) <= 6
      );
    case "league-leaders":
      return ctx.managerLeagueWinner === true;
    case "grand-final-winners":
      return ctx.managerGrandFinalWinner === true;
    case "double-winners":
      return ctx.managerDoubleWinner === true;
    case "treble-winners":
      return ctx.managerTrebleWinner === true;
    case "quadruple-winners":
      return ctx.managerQuadrupleWinner === true;
    case "clean-sweep":
      return ctx.managerCleanSweep === true;
    case "world-champions":
      return ctx.managerWorldClubChallengeWinner === true;
    case "perfect-trophy-season":
      return ctx.managerPerfectTrophySeason === true;
    case "academy-trust":
      return ctx.reserveCalledUp === true && ctx.managerWin === true;
    case "youth-breakthrough":
      return ctx.reservePromoted === true;
    case "transfer-room":
      return ctx.playerSigned === true;
    case "selling-club":
      return ctx.playerSold === true;
    case "contract-secured":
      return ctx.contractRenewed === true;
    case "packed-house":
      return (ctx.stadiumCapacityPct ?? 0) >= 95;
    case "board-favourite":
      return (ctx.boardConfidence ?? 0) >= 80;
    case "first-purchase":
      return ctx.themePurchased === true || progress.storeThemesUnlocked >= 1;
    case "theme-collector":
      return progress.storeThemesUnlocked >= 5;
    case "full-collection":
      return progress.storeThemesUnlocked >= progress.totalStoreThemes;
    case "millionaire-coach":
      return progress.clubFundsBalance >= 1_000_000;
    case "big-earner":
      return progress.lifetimeClubFundsEarned >= 5_000_000;
    case "reward-claimed":
      return ctx.managerSeasonRewardClaimed === true;
    case "getting-started":
      return ctx.profileOpened === true;
    case "regular-coach":
      return progress.totalSeasons >= 10;
    case "veteran-coach":
      return progress.totalSeasons >= 50;
    case "stat-machine":
      return progress.totalWins >= 100;
    case "tough-lessons":
      return progress.totalLosses >= 50;
    case "close-one":
      return ctx.matchWon === true && ctx.marginOfVictory === 1;
    case "statement-win":
      return ctx.matchWon === true && (ctx.marginOfVictory ?? 0) >= 40;
    case "mellor-miracle":
      return ctx.joeMellorComplete === true;
    case "goat-status":
      return ctx.goatMellorWin === true;
    case "secret-button":
      return ctx.secretButtonTriggered === true;
    case "against-the-odds":
      return ctx.againstTheOddsComplete === true;
    case "developers-favourite":
      return ctx.bradfordChallengeComplete === true;
    default:
      return false;
  }
}

export function getAchievementProgress(
  id: string,
  ctx: AchievementCheckContext = {}
): { current: number; target: number } | null {
  const def = getAchievementDefinition(id);
  if (!def?.target) return null;
  const progress = buildAchievementProgress(ctx);

  switch (id) {
    case "first-win":
      return { current: Math.min(progress.totalWins, def.target), target: def.target };
    case "winning-habit":
    case "chaser-27-0":
      return {
        current: Math.min(ctx.seasonWins ?? progress.seasonWinsCurrent, def.target),
        target: def.target,
      };
    case "unbeaten-again":
      return {
        current: Math.min(progress.unbeatenSeasons, def.target),
        target: def.target,
      };
    case "cup-dynasty":
      return {
        current: Math.min(progress.challengeCupsWon, def.target),
        target: def.target,
      };
    case "theme-collector":
      return {
        current: Math.min(progress.storeThemesUnlocked, def.target),
        target: def.target,
      };
    case "big-earner":
      return {
        current: Math.min(progress.lifetimeClubFundsEarned, def.target),
        target: def.target,
      };
    case "regular-coach":
    case "veteran-coach":
      return {
        current: Math.min(progress.totalSeasons, def.target),
        target: def.target,
      };
    case "stat-machine":
      return {
        current: Math.min(progress.totalWins, def.target),
        target: def.target,
      };
    case "tough-lessons":
      return {
        current: Math.min(progress.totalLosses, def.target),
        target: def.target,
      };
    default:
      return { current: 0, target: def.target };
  }
}

function payAchievementReward(
  id: string,
  amount: number,
  rows: UnlockedAchievement[]
): UnlockedAchievement[] {
  const row = rows.find((r) => r.id === id);
  if (!row || row.rewardClaimed || amount <= 0) return rows;

  const payout = awardClubFundsLines(`achievement-${id}`, [
    { id: `achievement-${id}`, label: "Achievement reward", amount },
  ]);
  if (!payout.awarded) return rows;

  return rows.map((r) =>
    r.id === id ? { ...r, rewardClaimed: true } : r
  );
}

export function getUnlockedAchievements(): UnlockedAchievement[] {
  return loadAchievements();
}

export function unlockAchievement(id: string): AchievementUnlockResult | null {
  const def = getAchievementDefinition(id);
  if (!def) return null;

  const rows = loadAchievements();
  if (isAchievementUnlocked(id)) return null;

  const unlockedAt = new Date().toISOString();
  let next = [
    ...rows,
    { id, unlockedAt, popupSeen: false, rewardClaimed: false },
  ];

  let rewardAmount: number | undefined;
  if (def.rewardClubFunds && def.rewardClubFunds > 0) {
    next = payAchievementReward(id, def.rewardClubFunds, next);
    rewardAmount = def.rewardClubFunds;
  }

  saveAchievements(next);
  return { id, definition: def, unlockedAt, rewardAmount };
}

export function markAchievementPopupSeen(id: string): void {
  const rows = loadAchievements();
  const next = rows.map((row) =>
    row.id === id ? { ...row, popupSeen: true } : row
  );
  saveAchievements(next);
}

export function checkAchievements(
  ctx: AchievementCheckContext = {}
): AchievementUnlockResult[] {
  const progress = buildAchievementProgress(ctx);
  const newlyUnlocked: AchievementUnlockResult[] = [];

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (isAchievementUnlocked(def.id)) continue;
    if (!evaluateUnlock(def, ctx, progress)) continue;

    const result = unlockAchievement(def.id);
    if (result) newlyUnlocked.push(result);
  }

  return newlyUnlocked;
}

export function getUnseenAchievementPopups(): AchievementUnlockResult[] {
  const results: AchievementUnlockResult[] = [];
  for (const row of loadAchievements()) {
    if (row.popupSeen) continue;
    const def = getAchievementDefinition(row.id);
    if (!def) continue;
    results.push({
      id: row.id,
      definition: def,
      unlockedAt: row.unlockedAt,
      rewardAmount: def.rewardClubFunds,
    });
  }
  return results;
}

export function countAchievementPoints(): number {
  return loadAchievements().reduce((sum, row) => {
    const def = getAchievementDefinition(row.id);
    return sum + (def?.points ?? 0);
  }, 0);
}

export function isAchievementRewardClaimed(id: string): boolean {
  return getUnlockedAchievement(id)?.rewardClaimed === true;
}
