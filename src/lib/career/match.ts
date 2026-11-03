import { LINEUP_SLOTS, benchBonus, effectiveRating } from "./players";
import { poisson, weightedPick, type Rng } from "./rng";
import { tacticEffect } from "./tactics";
import type { CareerPlayer, FixtureResult, Pos, Tactic, TacticSettings } from "./types";

export interface TeamSheet {
  clubId: string;
  /** 13 player ids in shirt order. */
  lineup: string[];
  tactic: Tactic;
  /** The three-part game plan (v1.66). When set it replaces `tactic`. */
  tactics?: TacticSettings;
  /** Small temporary rating bonus (pre-season match sharpness). */
  boost?: number;
  /** Interchange (shirts 14–17). Counts a little towards strength; career sheets always set it. */
  bench?: string[];
  /** Captain: a small lift while he's on the field (every club has one). */
  captain?: string;
}

/** Rating lift for having your captain in the XIII. Every club gets it, so it's fair. */
export const CAPTAIN_BOOST = 0.3;

const TRY_WEIGHT: Record<Pos, number> = {
  WG: 3.2, CE: 2.3, FB: 2.1, SO: 1.4, SH: 1.2, LF: 1.0, SR: 1.15, HK: 0.75, PR: 0.6,
};

/** Tuned so a typical Super League game lands around 22–18 with realistic upsets. */
const BASE_TRIES = 3.6;
const RATING_SCALE = 3.4;
const HOME_EDGE = 0.9;
/** A bench man's share of the try-scoring chances of a starter in his position. */
const BENCH_TRY_SHARE = 0.35;

export function sheetStrength(sheet: TeamSheet, players: Record<string, CareerPlayer>) {
  let total = 0;
  let count = 0;
  LINEUP_SLOTS.forEach((slot, i) => {
    const p = players[sheet.lineup[i] ?? ""];
    total += p ? effectiveRating(p, slot) : 55;
    count++;
  });
  const xiii = total / count;
  const captain = sheet.captain && sheet.lineup.includes(sheet.captain) && players[sheet.captain] ? CAPTAIN_BOOST : 0;
  const rating = xiii + benchBonus(xiii, sheet.bench, players) + (sheet.boost ?? 0) + captain;
  if (!sheet.tactics) {
    // Sheets without the three-part plan (tests, old callers): the old single tactic.
    const attackMod = sheet.tactic === "attack" ? 1.0 : sheet.tactic === "defend" ? -0.8 : 0;
    const defenceMod = sheet.tactic === "defend" ? 1.0 : sheet.tactic === "attack" ? -0.8 : 0;
    const tempo = sheet.tactic === "attack" ? 1.04 : sheet.tactic === "defend" ? 0.95 : 1;
    return { rating, attack: rating + attackMod, defence: rating + defenceMod, tempo, pens: 0 };
  }
  const e = tacticEffect(sheet.tactics);
  return { rating, attack: rating + e.attack, defence: rating + e.defence, tempo: e.tempo, pens: e.pens };
}

export function pickScorer(rng: Rng, sheet: TeamSheet, players: Record<string, CareerPlayer>): string {
  const slots = LINEUP_SLOTS.map((slot, i) => ({ slot, id: sheet.lineup[i] ?? "", share: 1 })).filter((s) => players[s.id]);
  if (slots.length === 0) return "";
  // Bench men play part of the game, so they score now and then.
  for (const id of sheet.bench ?? []) {
    const p = players[id];
    if (p) slots.push({ slot: p.pos, id, share: BENCH_TRY_SHARE });
  }
  return weightedPick(rng, slots, (s) => s.share * TRY_WEIGHT[s.slot] * Math.pow((players[s.id]!.rating) / 80, 3)).id;
}

/** Chance a team has a player sent off in a match. */
export const SEND_OFF_CHANCE = 0.05;
/** Strength lost for playing a whole match with 12 (scaled by the minutes left). */
const RED_CARD_COST = 3;

const RED_WEIGHT: Record<Pos, number> = { PR: 3, SR: 2.5, LF: 2.5, HK: 2, CE: 1.2, SO: 0.8, SH: 0.8, FB: 0.6, WG: 0.6 };

/** Maybe a red card: who and when (minute 5–75). Forwards see more of them. */
export function rollSendOff(rng: Rng, sheet: TeamSheet, players: Record<string, CareerPlayer>): { id: string; minute: number } | null {
  if (rng() >= SEND_OFF_CHANCE) return null;
  const ids = sheet.lineup.filter((id) => players[id]);
  if (!ids.length) return null;
  const id = weightedPick(rng, ids, (x) => RED_WEIGHT[players[x]!.pos]);
  return { id, minute: 5 + Math.floor(rng() * 71) };
}

function shortHanded<T extends { rating: number; attack: number; defence: number }>(s: T, red: { minute: number } | null): T {
  if (!red) return s;
  const cost = (RED_CARD_COST * (80 - red.minute)) / 80;
  return { ...s, attack: s.attack - cost, defence: s.defence - cost };
}

function withoutPlayer(sheet: TeamSheet, id: string): TeamSheet {
  return { ...sheet, lineup: sheet.lineup.map((x) => (x === id ? "" : x)) };
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
  /** neutral: Magic Weekend, no home advantage. */
  opts: { knockout: boolean; neutral?: boolean }
): FixtureResult {
  // Red cards: rare (about one team in twenty). The side is a man short for the rest of the game.
  const homeRed = rollSendOff(rng, home, players);
  const awayRed = rollSendOff(rng, away, players);
  const h = shortHanded(sheetStrength(home, players), homeRed);
  const a = shortHanded(sheetStrength(away, players), awayRed);
  if (homeRed) home = withoutPlayer(home, homeRed.id);
  if (awayRed) away = withoutPlayer(away, awayRed.id);

  // Game plans: an open game (expansive, attacking kicks) means more tries both ways.
  const tempo = h.tempo * a.tempo;
  const homeTryMean = expectedTries(h.attack, a.defence, !opts.neutral) * tempo;
  const awayTryMean = expectedTries(a.attack, h.defence, false) * tempo;

  const homeTryCount = poisson(rng, homeTryMean);
  const awayTryCount = poisson(rng, awayTryMean);

  const conversions = (tries: number, rating: number) => {
    let made = 0;
    const accuracy = Math.min(0.85, 0.55 + (rating - 75) * 0.015);
    for (let i = 0; i < tries; i++) if (rng() < accuracy) made++;
    return made;
  };
  // A rushing defence gives away more penalties: the other side's shots at goal.
  const penalties = (strength: number, conceded: number) => poisson(rng, Math.max(0.1, 0.45 + Math.max(0, strength - 80) * 0.03 + conceded));

  let homeScore = homeTryCount * 4 + conversions(homeTryCount, h.rating) * 2 + penalties(h.rating, a.pens) * 2;
  let awayScore = awayTryCount * 4 + conversions(awayTryCount, a.rating) * 2 + penalties(a.rating, h.pens) * 2;

  // Occasional drop goal in tight games.
  if (Math.abs(homeScore - awayScore) <= 2 && rng() < 0.25) {
    if (rng() < 0.5 + (h.rating - a.rating) * 0.05) homeScore += 1;
    else awayScore += 1;
  }

  let goldenPoint = false;
  if (opts.knockout && homeScore === awayScore) {
    goldenPoint = true;
    const homeWins = rng() < 0.5 + (h.rating - a.rating) * 0.06 + (opts.neutral ? 0 : 0.04);
    if (homeWins) homeScore += 1;
    else awayScore += 1;
  }

  const homeTries = Array.from({ length: homeTryCount }, () => pickScorer(rng, home, players)).filter(Boolean);
  const awayTries = Array.from({ length: awayTryCount }, () => pickScorer(rng, away, players)).filter(Boolean);

  const motm = pickMotm(rng, home, away, homeScore, awayScore, homeTries, awayTries, players);
  return {
    homeScore,
    awayScore,
    homeTries,
    awayTries,
    goldenPoint: goldenPoint || undefined,
    motm,
    homeSentOff: homeRed ? [homeRed.id] : undefined,
    awaySentOff: awayRed ? [awayRed.id] : undefined,
  };
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
