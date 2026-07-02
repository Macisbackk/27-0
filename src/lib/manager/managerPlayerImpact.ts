import type { ManagerCareer } from "./types";

export interface PlayerSeasonImpactInput {
  appearances: number;
  tries: number;
  form: number;
  goals?: number;
  playerOfMatch?: number;
  teamGamesPlayed?: number;
}

/** 0–100 season performance score (50 = average). */
export function computePlayerSeasonImpact(
  input: PlayerSeasonImpactInput
): number {
  const {
    appearances,
    tries,
    form,
    goals = 0,
    playerOfMatch = 0,
    teamGamesPlayed = 1,
  } = input;

  if (appearances === 0) {
    return Math.round(Math.max(18, Math.min(42, form * 0.35 + 8)));
  }

  const teamGames = Math.max(teamGamesPlayed, appearances, 1);
  const appShare = appearances / teamGames;
  const involvementScore = Math.min(
    100,
    (appShare / 0.72) * 58 + (appearances >= 8 ? 12 : 0)
  );

  const outputRaw = tries * 4 + goals * 2 + playerOfMatch * 6;
  const outputPerApp = outputRaw / appearances;
  const outputScore = Math.min(100, 32 + outputPerApp * 14);

  // High minutes alone shouldn't mask poor form and low output.
  const playQuality = Math.min(1, (form * 0.55 + outputScore * 0.45) / 50);
  const adjustedInvolvement = involvementScore * playQuality;

  const impact =
    form * 0.5 + adjustedInvolvement * 0.22 + outputScore * 0.28;

  return Math.round(Math.max(0, Math.min(100, impact)));
}

export function getPlayerSeasonImpact(
  career: ManagerCareer,
  playerId: string
): number {
  const ps = career.squad.find((p) => p.playerId === playerId);
  const stats = career.playerSeasonStats[playerId];
  const appearances = ps?.seasonAppearances ?? stats?.appearances ?? 0;
  const tries = ps?.seasonTries ?? stats?.tries ?? 0;
  const form = ps?.form ?? 50;
  const goals = stats?.goals ?? 0;
  const playerOfMatch = stats?.playerOfMatch ?? 0;
  const teamGamesPlayed =
    career.teamSeasonStats.played ||
    career.fixtures.filter((f) => (f.competition ?? "league") !== "friendly")
      .length ||
    1;

  return computePlayerSeasonImpact({
    appearances,
    tries,
    form,
    goals,
    playerOfMatch,
    teamGamesPlayed,
  });
}

export function impactLabel(score: number): string {
  if (score >= 78) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 52) return "Average";
  if (score >= 40) return "Poor";
  if (score >= 28) return "Very poor";
  return "Awful";
}

export type ImpactTone = "excellent" | "good" | "average" | "poor" | "bad";

export function impactTone(score: number): ImpactTone {
  if (score >= 78) return "excellent";
  if (score >= 65) return "good";
  if (score >= 52) return "average";
  if (score >= 40) return "poor";
  return "bad";
}

export const IMPACT_TONE_CLASS: Record<ImpactTone, string> = {
  excellent: "text-accent-gold border-accent-gold/45 bg-accent-gold/12",
  good: "text-theme-primary border-theme-primary/40 bg-theme-primary/10",
  average: "text-pitch-300 border-pitch-600/50 bg-pitch-800/50",
  poor: "text-amber-300 border-amber-400/35 bg-amber-500/10",
  bad: "text-red-300 border-red-500/35 bg-red-500/10",
};

/** Extra rating delta from season impact (applied at season end). */
export function impactDevelopmentDelta(
  impact: number,
  appearances: number
): number {
  if (appearances === 0) return impact < 35 ? -0.25 : 0;

  if (impact < 28) return -1.15;
  if (impact < 35) return -0.85;
  if (impact < 40) return -0.6;
  if (impact < 45) return -0.35;
  if (impact >= 78) return 0.55;
  if (impact >= 65) return 0.3;
  return 0;
}

/** Poor seasons increase chance of an extra −1 at season end. */
export function rollImpactRegression(
  impact: number,
  appearances: number,
  rng: () => number
): number {
  if (appearances < 4 || impact >= 45) return 0;
  if (impact < 28) return rng() < 0.55 ? -1 : 0;
  if (impact < 35) return rng() < 0.42 ? -1 : 0;
  if (impact < 40) return rng() < 0.3 ? -1 : 0;
  return rng() < 0.15 ? -1 : 0;
}

export function isPoorSeasonImpact(impact: number): boolean {
  return impact < 42;
}
