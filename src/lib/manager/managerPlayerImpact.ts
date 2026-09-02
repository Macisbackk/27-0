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
  // Tiny samples never swing ratings hard.
  if (appearances === 0) return 0;
  if (appearances < 4) return impact < 30 ? -0.15 : 0;

  // Sustained poor form can decline; one weak stretch should not crater a star.
  if (appearances >= 18 && impact < 38) return -0.55;
  if (appearances >= 12 && impact < 32) return -0.7;
  if (appearances >= 12 && impact < 40) return -0.35;
  if (appearances >= 8 && impact < 28) return -0.45;
  if (impact < 35 && appearances >= 8) return -0.2;

  // High impact needs minutes — strong sample, meaningful upside.
  if (appearances >= 16 && impact >= 78) return 0.45;
  if (appearances >= 12 && impact >= 72) return 0.3;
  if (appearances >= 10 && impact >= 65) return 0.2;
  if (appearances >= 8 && impact >= 58) return 0.1;
  return 0;
}

/** Poor seasons increase chance of an extra −1 at season end. */
export function rollImpactRegression(
  impact: number,
  appearances: number,
  rng: () => number
): number {
  // Need a real sample — a handful of games must not tank a career.
  if (appearances < 10 || impact >= 48) return 0;
  if (impact < 28) return rng() < 0.32 ? -1 : 0;
  if (impact < 35) return rng() < 0.22 ? -1 : 0;
  if (impact < 40) return rng() < 0.12 ? -1 : 0;
  return 0;
}

export function isPoorSeasonImpact(impact: number): boolean {
  return impact < 42;
}

/** Team results scale how much positive development the squad earns. */
export function getTeamSeasonDevelopmentModifier(
  career: ManagerCareer,
  club?: string
): number {
  const targetClub = club ?? career.club;
  const row = career.leagueTable.find((entry) => entry.team === targetClub);

  const played = row?.played ?? career.teamSeasonStats.played;
  const wins = row?.wins ?? career.teamSeasonStats.wins;
  if (played < 6) return 1;

  const winRate = wins / played;
  const position = row?.position ?? 14;

  let mod = 0.68 + winRate * 0.62;
  if (position <= 3) mod += 0.1;
  else if (position <= 6) mod += 0.05;
  else if (position >= 11) mod -= 0.08;
  else if (position >= 13) mod -= 0.14;

  return Math.max(0.52, Math.min(1.28, mod));
}

/** Positive rating growth from impact, minutes, age, and team context. */
export function computeImpactBasedGrowth(
  impact: number,
  appearances: number,
  age: number,
  potentialGap: number,
  teamMod: number,
  minAppearances = 10
): number {
  if (appearances < minAppearances || isPoorSeasonImpact(impact)) return 0;
  // Low-impact / fringe roles: no automatic climb from a few tidy games.
  if (impact < 55) return 0;

  const impactNorm = Math.max(0, Math.min(1, (impact - 55) / 30));
  if (impactNorm <= 0) return 0;

  // Diminishing returns — youth can still rise, stars climb slowly.
  const maxGain =
    age <= 21
      ? 1.65
      : age <= 24
        ? 1.35
        : age <= 27
          ? 0.95
          : age <= 29
            ? 0.55
            : 0.25;

  const appFactor =
    appearances >= 22
      ? 1
      : appearances >= 18
        ? 0.88
        : appearances >= 14
          ? 0.72
          : appearances >= minAppearances
            ? 0.5
            : 0;

  // Near potential → much smaller gains.
  const gapFactor =
    potentialGap <= 0
      ? 0
      : potentialGap <= 2
        ? 0.35
        : potentialGap <= 5
          ? 0.65
          : 1;

  let gain = impactNorm * maxGain * appFactor * teamMod * gapFactor;

  if (impact >= 72 && potentialGap >= 8 && age <= 25 && appearances >= 16) {
    gain += 0.12 * Math.min(1, potentialGap / 12) * impactNorm;
  }

  return gain;
}
