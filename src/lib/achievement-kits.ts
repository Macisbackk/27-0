/**
 * Achievement kits (v1.66): ready-made shirts that are never sold, only earned. Like the More
 * modes unlocks (lib/mode-unlocks.ts) each grants a notForSale cosmetic, so it rides the
 * cosmetics cloud sync and an earned kit is never taken away.
 *
 *   Invincibles kit    go 27-0 in Classic           (achievement "perfect-season", or Ball Knower owned)
 *   29-0 kit           27-0 then 2-0 in the play-offs (achievement "29-0")
 *   Month of Dailies   a 30-day Daily streak         (Daily meta best streak)
 *   Centurion kit      a 100-day Daily streak        (Daily meta best streak)
 *   Old Trafford kit   win the Manager Mode Super League Grand Final (achievement "manager-old-trafford")
 *
 * syncAchievementKits() backfills from what is already stored, so it is safe to call on load and
 * after any achievement unlock. Kept free of the game engine imports (achievements storage,
 * cosmetics store and a raw read of the Daily meta) so the achievement engine can call it.
 * Tests: scripts/test-store.ts.
 */
import {
  BALL_KNOWER_ID,
  KIT_29_0_ID,
  KIT_MANAGER_GF_ID,
  KIT_PERFECT_ID,
  KIT_STREAK_100_ID,
  KIT_STREAK_30_ID,
} from "./cosmetics";
import { SHOW_DAILY_CHALLENGE_UI } from "./feature-flags";
import { loadAchievements } from "./achievements/achievementStorage";
import { STORAGE_KEYS } from "./storage/keys";
import { getCosmetics, grantCosmetic } from "./storage/cosmetics-store";

export interface AchievementKitEvidence {
  achievements: readonly string[];
  /** Best Daily Challenge streak (current counts too). */
  bestDailyStreak: number;
  /** Cosmetics already owned (Ball Knower = a 27-0 already happened). */
  owned: readonly string[];
}

export interface AchievementKit {
  id: string;
  /** "Earn: …" text on the locked card. */
  earn: string;
  earned: (e: AchievementKitEvidence) => boolean;
}

export const ACHIEVEMENT_KITS: readonly AchievementKit[] = [
  {
    id: KIT_PERFECT_ID,
    earn: "Go 27-0 in Classic.",
    earned: (e) => e.achievements.includes("perfect-season") || e.owned.includes(BALL_KNOWER_ID),
  },
  { id: KIT_29_0_ID, earn: "Go 27-0, then win both play-off games.", earned: (e) => e.achievements.includes("29-0") },
  ...(SHOW_DAILY_CHALLENGE_UI
    ? [
        { id: KIT_STREAK_30_ID, earn: "Reach a 30-day Daily streak.", earned: (e: AchievementKitEvidence) => e.bestDailyStreak >= 30 },
        { id: KIT_STREAK_100_ID, earn: "Reach a 100-day Daily streak.", earned: (e: AchievementKitEvidence) => e.bestDailyStreak >= 100 },
      ]
    : []),
  {
    id: KIT_MANAGER_GF_ID,
    earn: "Win a Grand Final in Manager Mode.",
    earned: (e) => e.achievements.includes("manager-old-trafford"),
  },
];

export const achievementKitById = (id: string) => ACHIEVEMENT_KITS.find((k) => k.id === id);

/** Kit ids the evidence earns (pure). */
export function earnedAchievementKitIds(e: AchievementKitEvidence): string[] {
  return ACHIEVEMENT_KITS.filter((k) => k.earned(e)).map((k) => k.id);
}

function readBestDailyStreak(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dailyChallengeMeta);
    if (!raw) return 0;
    const p = JSON.parse(raw) as { currentStreak?: unknown; bestStreak?: unknown };
    return Math.max(Number(p.currentStreak) || 0, Number(p.bestStreak) || 0);
  } catch {
    return 0;
  }
}

export function readAchievementKitEvidence(): AchievementKitEvidence {
  let achievements: string[] = [];
  try {
    achievements = loadAchievements().map((r) => r.id);
  } catch {
    achievements = [];
  }
  let owned: string[] = [];
  try {
    owned = getCosmetics().owned;
  } catch {
    owned = [];
  }
  return { achievements, bestDailyStreak: readBestDailyStreak(), owned };
}

/** Grant every achievement kit already earned. Returns the ids newly granted (idempotent). */
export function syncAchievementKits(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const e = readAchievementKitEvidence();
    const out: string[] = [];
    for (const id of earnedAchievementKitIds(e)) {
      if (e.owned.includes(id)) continue;
      if (grantCosmetic(id)) out.push(id);
    }
    return out;
  } catch {
    return [];
  }
}
