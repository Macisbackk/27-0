import { LINEUP_SLOTS, effectiveRating } from "./players";
import { poisson, weightedPick, type Rng } from "./rng";
import type { CareerPlayer, FixtureResult, Pos, Tactic } from "./types";

export interface TeamSheet {
  clubId: string;
  /** 13 player ids in shirt order. */
  lineup: string[];
  tactic: Tactic;
  /** Small temporary rating bonus (pre-season match sharpness). */
  boost?: number;
}

const TRY_WEIGHT: Record<Pos, number> = {
  WG: 3.2, CE: 2.3, FB: 2.1, SO: 1.4, SH: 1.2, LF: 1.0, SR: 1.15, HK: 0.75, PR: 0.6,
};

/** Tuned so a typical Super League game lands around 22–18 with realistic upsets. */
const BASE_TRIES = 3.6;
const RATING_SCALE = 3.4;
const HOME_EDGE = 0.9;

export function sheetStrength(sheet: TeamSheet, players: Record<string, CareerPlayer>) {
  let total = 0;
  let count = 0;
  LINEUP_SLOTS.forEach((slot, i) => {
    const p = players[sheet.lineup[i] ?? ""];
    total += p ? effectiveRating(p, slot) : 55;
    count++;
  });
  const rating = total / count + (sheet.boost ?? 0);
  const attackMod = sheet.tactic === "attack" ? 1.0 : sheet.tactic === "defend" ? -0.8 : 0;
  const defenceMod = sheet.tactic === "defend" ? 1.0 : sheet.tactic === "attack" ? -0.8 : 0;
  return { rating, attack: rating + attackMod, defence: rating + defenceMod };
}

export function pickScorer(rng: Rng, sheet: TeamSheet, players: Record<string, CareerPlayer>): string {
  const slots = LINEUP_SLOTS.map((slot, i) => ({ slot, id: sheet.lineup[i] ?? "" })).filter((s) => players[s.id]);
  if (slots.length === 0) return "";
  return weightedPick(rng, slots, (s) => TRY_WEIGHT[s.slot] * Math.pow((players[s.id]!.rating) / 80, 3)).id;
}

/** Win probability helper for UI ("You're favourites" etc.). */
export function expectedTries(attack: number, defence: number, home: boolean): number {
  return BASE_TRIES * Math.exp((attack - defence + (home ? HOME_EDGE : 0)) / RATING_SCALE / 2.2);
}

export function simulateMatch(
  rng: Rng,
  home: TeamSheet,
  away: TeamSheet,
  players: Record<string, CareerPlayer>,
  opts: { knockout: boolean }
): FixtureResult {
  const h = sheetStrength(home, players);
  const a = sheetStrength(away, players);

  const homeTryMean = expectedTries(h.attack, a.defence, true);
  const awayTryMean = expectedTries(a.attack, h.defence, false);

  const homeTryCount = poisson(rng, homeTryMean);
  const awayTryCount = poisson(rng, awayTryMean);

  const conversions = (tries: number, rating: number) => {
    let made = 0;
    const accuracy = Math.min(0.85, 0.55 + (rating - 75) * 0.015);
    for (let i = 0; i < tries; i++) if (rng() < accuracy) made++;
    return made;
  };
  const penalties = (strength: number) => poisson(rng, 0.45 + Math.max(0, strength - 80) * 0.03);

  let homeScore = homeTryCount * 4 + conversions(homeTryCount, h.rating) * 2 + penalties(h.rating) * 2;
  let awayScore = awayTryCount * 4 + conversions(awayTryCount, a.rating) * 2 + penalties(a.rating) * 2;

  // Occasional drop goal in tight games.
  if (Math.abs(homeScore - awayScore) <= 2 && rng() < 0.25) {
    if (rng() < 0.5 + (h.rating - a.rating) * 0.05) homeScore += 1;
    else awayScore += 1;
  }

  let goldenPoint = false;
  if (opts.knockout && homeScore === awayScore) {
    goldenPoint = true;
    const homeWins = rng() < 0.5 + (h.rating - a.rating) * 0.06 + 0.04;
    if (homeWins) homeScore += 1;
    else awayScore += 1;
  }

  const homeTries = Array.from({ length: homeTryCount }, () => pickScorer(rng, home, players)).filter(Boolean);
  const awayTries = Array.from({ length: awayTryCount }, () => pickScorer(rng, away, players)).filter(Boolean);

  const motm = pickMotm(rng, home, away, homeScore, awayScore, homeTries, awayTries, players);
  return { homeScore, awayScore, homeTries, awayTries, goldenPoint: goldenPoint || undefined, motm };
}

/** Man of the match: from the winning side, favouring try scorers and high ratings. */
export function pickMotm(
  rng: Rng,
  home: TeamSheet,
  away: TeamSheet,
  homeScore: number,
  awayScore: number,
  homeTries: string[],
  awayTries: string[],
  players: Record<string, CareerPlayer>
): string | undefined {
  const winner = homeScore >= awayScore ? home : away;
  const winnerTries = homeScore >= awayScore ? homeTries : awayTries;
  const candidates = winner.lineup.filter((id) => players[id]);
  return candidates.length
    ? weightedPick(rng, candidates, (id) => {
        const tries = winnerTries.filter((t) => t === id).length;
        return Math.pow(players[id]!.rating / 80, 4) * (1 + tries * 2.5);
      })
    : undefined;
}
