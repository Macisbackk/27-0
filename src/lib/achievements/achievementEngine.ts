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
  createUnlockEventId,
  getUnlockedAchievement,
  isAchievementUnlocked,
  loadAchievements,
  saveAchievements,
  type UnlockedAchievement,
} from "./achievementStorage";
import { awardClubFundsLines } from "../storage/club-funds";
import {
  ACHIEVEMENTS_BASELINE_VERSION,
  STORAGE_KEYS,
} from "../storage/keys";

export type AchievementUnlockResult = {
  id: string;
  definition: AchievementDefinition;
  unlockedAt: string;
  unlockEventId: string;
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
    case "29-0":
      return (
        ctx.quickModeLeagueSeason === true &&
        ctx.regularSeasonWins === 27 &&
        ctx.regularSeasonLosses === 0 &&
        ctx.seasonDraws === 0 &&
        ctx.playoffWins === 2 &&
        ctx.playoffLosses === 0 &&
        ctx.leagueChampion === true
      );
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
  // Never unlock twice — ledger is the source of truth.
  if (rows.some((r) => r.id === id)) return null;

  const unlockedAt = new Date().toISOString();
  const unlockEventId = createUnlockEventId(id, unlockedAt);
  let next: UnlockedAchievement[] = [
    ...rows,
    {
      id,
      unlockedAt,
      unlockEventId,
      popupAcknowledged: false,
      rewardClaimed: false,
    },
  ];

  let rewardAmount: number | undefined;
  if (def.rewardClubFunds && def.rewardClubFunds > 0) {
    next = payAchievementReward(id, def.rewardClubFunds, next);
    rewardAmount = def.rewardClubFunds;
  }

  saveAchievements(next);
  return { id, definition: def, unlockedAt, unlockEventId, rewardAmount };
}

/** Persist acknowledgement before the popup closes — never requeues after. */
export function markAchievementPopupAcknowledged(id: string): void {
  const rows = loadAchievements();
  let changed = false;
  const next = rows.map((row) => {
    if (row.id !== id || row.popupAcknowledged) return row;
    changed = true;
    return { ...row, popupAcknowledged: true };
  });
  if (changed) saveAchievements(next);
}

/** @deprecated Use markAchievementPopupAcknowledged */
export function markAchievementPopupSeen(id: string): void {
  markAchievementPopupAcknowledged(id);
}

/**
 * One-time / mount migration: mark every already-unlocked achievement as
 * acknowledgement-complete without showing popups.
 */
export function acknowledgeExistingAchievementPopups(): number {
  const rows = loadAchievements();
  let changed = 0;
  const next = rows.map((row) => {
    if (row.popupAcknowledged) return row;
    changed += 1;
    return { ...row, popupAcknowledged: true };
  });
  if (changed > 0) saveAchievements(next);
  return changed;
}

function readBaselineVersion(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.achievementsBaselineVersion);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeBaselineVersion(version: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEYS.achievementsBaselineVersion,
      String(version)
    );
  } catch {
    /* ignore quota */
  }
}

/**
 * After local + account progress are available: union unlocked IDs from
 * progress into the ledger (silent, acknowledged). Preserves existing
 * popupAcknowledged flags for rows already in the ledger.
 * Baseline IDs come from the ledger so hydrate never replays acknowledged unlocks.
 */
export function synchronizeAchievementBaseline(
  ctx: AchievementCheckContext = {}
): { unlockedIds: string[]; acknowledgedIds: string[]; migrated: boolean } {
  const progress = buildAchievementProgress(ctx);
  const existing = loadAchievements();
  const byId = new Map(existing.map((row) => [row.id, row]));
  const now = new Date().toISOString();
  const needsMigration = readBaselineVersion() < ACHIEVEMENTS_BASELINE_VERSION;

  // One-time migration: mark every existing ledger row acknowledged.
  if (needsMigration) {
    for (const [id, prev] of byId) {
      byId.set(id, {
        ...prev,
        unlockEventId:
          prev.unlockEventId || createUnlockEventId(prev.id, prev.unlockedAt),
        popupAcknowledged: true,
      });
    }
  }

  // Import progress-satisfied achievements that are missing from the ledger
  // (e.g. after wipe while stats/cloud progress remains). Silent — no popups.
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (!evaluateUnlock(def, ctx, progress)) continue;
    const prev = byId.get(def.id);
    if (!prev) {
      byId.set(def.id, {
        id: def.id,
        unlockedAt: now,
        unlockEventId: createUnlockEventId(def.id, now),
        popupAcknowledged: true,
        // Historical / imported unlocks — do not re-pay club funds.
        rewardClaimed: true,
      });
    }
  }

  const next = Array.from(byId.values());
  saveAchievements(next);
  writeBaselineVersion(ACHIEVEMENTS_BASELINE_VERSION);

  return {
    unlockedIds: next.map((row) => row.id),
    acknowledgedIds: next
      .filter((row) => row.popupAcknowledged)
      .map((row) => row.id),
    migrated: needsMigration,
  };
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
    if (row.popupAcknowledged) continue;
    const def = getAchievementDefinition(row.id);
    if (!def) continue;
    results.push({
      id: row.id,
      definition: def,
      unlockedAt: row.unlockedAt,
      unlockEventId: row.unlockEventId,
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
