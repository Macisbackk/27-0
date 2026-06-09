import seedrandom from "seedrandom";
import type { Position, SquadSlot } from "../types";
import { buildOpponentScoringDetail } from "./opponent-scorers";
import type {
  FixtureScoringDetail,
  MatchFixture,
  TeamScoringDetail,
} from "./season-simulation";
import { allocateMatchTries } from "./try-allocation";
import {
  getPlayerTryWeight,
  POSITION_TRY_WEIGHT,
} from "./try-weights";

export { POSITION_TRY_WEIGHT } from "./try-weights";

const POSITION_SHARE_MAX: Record<Position, number> = {
  WING: 0.32,
  CENTRE: 0.2,
  FULLBACK: 0.22,
  STAND_OFF: 0.14,
  SCRUM_HALF: 0.12,
  HOOKER: 0.08,
  SECOND_ROW: 0.1,
  LOOSE_FORWARD: 0.08,
  PROP: 0.05,
};

export interface PlayerTryTotal {
  playerId: string;
  name: string;
  club: string;
  position: Position;
  tries: number;
}

interface SquadEntry {
  player: SquadSlot["player"] & NonNullable<SquadSlot["player"]>;
}

function getMaxIndividualTries(seasonWins: number, seasonTries: number): number {
  if (seasonWins <= 6) return Math.min(14, Math.max(6, Math.ceil(seasonTries * 0.28)));
  if (seasonWins <= 14) return Math.min(22, Math.max(10, Math.ceil(seasonTries * 0.3)));
  if (seasonWins <= 22) return Math.min(30, Math.max(14, Math.ceil(seasonTries * 0.32)));
  return Math.min(38, Math.max(18, Math.ceil(seasonTries * 0.34)));
}

function getPositionCap(position: Position, seasonTries: number): number {
  return Math.max(1, Math.ceil(seasonTries * POSITION_SHARE_MAX[position]));
}

function getPlayerCap(
  entry: SquadEntry,
  seasonTries: number,
  seasonWins: number
): number {
  return Math.min(
    getMaxIndividualTries(seasonWins, seasonTries),
    getPositionCap(entry.player.position, seasonTries)
  );
}

function getMatchWeights(entries: SquadEntry[], rng: () => number): number[] {
  return entries.map((e) => {
    const base = getPlayerTryWeight(e.player);
    const variance = 0.88 + rng() * 0.24;
    return Math.max(0.05, base * variance);
  });
}

function pickKicker(entries: SquadEntry[]): SquadEntry | null {
  const halves = entries.filter(
    (e) =>
      e.player.position === "SCRUM_HALF" ||
      e.player.position === "STAND_OFF"
  );
  if (halves.length === 0) return entries[0] ?? null;
  return halves.sort((a, b) => b.player.peakRating - a.player.peakRating)[0];
}

function buildDreamTeamScoring(
  entries: SquadEntry[],
  matchAlloc: number[],
  fixture: MatchFixture
): TeamScoringDetail {
  const tryScorers = entries
    .map((e, i) => ({
      playerId: e.player.id,
      name: e.player.name,
      tries: matchAlloc[i],
    }))
    .filter((s) => s.tries > 0);

  const kicker = pickKicker(entries);
  const scoring = fixture.scoringFor;

  const kicking = kicker
    ? {
        playerId: kicker.player.id,
        name: kicker.player.name,
        conversions: scoring.conversions,
        conversionAttempts: scoring.tries,
        penalties: scoring.penalties,
        dropGoals: scoring.dropGoals,
      }
    : null;

  return { tryScorers, kicking };
}

function applyScoringDetails(
  entries: SquadEntry[],
  fixtures: MatchFixture[],
  perMatchAllocs: number[][],
  seed: string
): void {
  fixtures.forEach((fixture, fi) => {
    fixture.scoringDetail = {
      dreamTeam: buildDreamTeamScoring(entries, perMatchAllocs[fi], fixture),
      opponent: buildOpponentScoringDetail(fixture, seed),
    };
  });
}

function getSeasonTotals(perMatchAllocs: number[][]): number[] {
  const playerCount = perMatchAllocs[0]?.length ?? 0;
  const totals = new Array(playerCount).fill(0);
  for (const alloc of perMatchAllocs) {
    for (let i = 0; i < playerCount; i++) {
      totals[i] += alloc[i];
    }
  }
  return totals;
}

function transferTryInFixture(
  alloc: number[],
  fromIdx: number,
  toIdx: number
): boolean {
  if (fromIdx === toIdx || alloc[fromIdx] <= 0) return false;
  alloc[fromIdx]--;
  alloc[toIdx]++;
  return true;
}

function pickWeightedIndex(
  candidates: { i: number; weight: number }[],
  rng: () => number
): number {
  const weightSum = candidates.reduce((sum, c) => sum + c.weight, 0);
  let pick = rng() * weightSum;
  for (const c of candidates) {
    pick -= c.weight;
    if (pick <= 0) return c.i;
  }
  return candidates[candidates.length - 1].i;
}

/**
 * Soft cap rebalance — transfers tries to higher-weight (prolific) players
 * while preserving per-match try totals.
 */
function rebalanceTowardCaps(
  entries: SquadEntry[],
  perMatchAllocs: number[][],
  seasonTries: number,
  seasonWins: number,
  rng: () => number
): void {
  const caps = entries.map((e) => getPlayerCap(e, seasonTries, seasonWins));
  const weights = entries.map((e) => getPlayerTryWeight(e.player));
  const maxIterations = seasonTries * entries.length * 3;

  for (let guard = 0; guard < maxIterations; guard++) {
    const totals = getSeasonTotals(perMatchAllocs);
    const overIdx = totals.findIndex((t, i) => t > caps[i]);
    if (overIdx === -1) break;

    const fixtureCandidates = perMatchAllocs
      .map((alloc, fi) => (alloc[overIdx] > 0 ? fi : -1))
      .filter((fi) => fi >= 0);
    if (fixtureCandidates.length === 0) break;

    const fi =
      fixtureCandidates[Math.floor(rng() * fixtureCandidates.length)];
    const alloc = perMatchAllocs[fi];

    const underCandidates = entries
      .map((e, i) => ({
        i,
        headroom: caps[i] - totals[i],
        weight: weights[i],
      }))
      .filter((c) => c.i !== overIdx && c.headroom > 0);

    if (underCandidates.length === 0) break;

    const toIdx = pickWeightedIndex(
      underCandidates.map((c) => ({ i: c.i, weight: c.weight })),
      rng
    );
    if (!transferTryInFixture(alloc, overIdx, toIdx)) break;
  }
}

/** Sum try scorers from all fixture details — must match season totals. */
export function aggregateTryTotalsFromFixtures(
  squad: SquadSlot[],
  fixtures: MatchFixture[]
): PlayerTryTotal[] {
  const entries = squad
    .filter((s) => s.player)
    .map((s) => s.player!);

  const totals = new Map<string, number>();

  for (const fixture of fixtures) {
    const scorers = fixture.scoringDetail?.dreamTeam.tryScorers ?? [];
    for (const s of scorers) {
      totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.tries);
    }
  }

  return entries
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      club: p.club,
      position: p.position,
      tries: totals.get(p.id) ?? 0,
    }))
    .filter((t) => t.tries > 0)
    .sort((a, b) => b.tries - a.tries);
}

/** Attach try scorers and kicking to a single fixture (cup / inline details). */
export function enrichSingleFixtureScoring(
  squad: SquadSlot[],
  fixture: MatchFixture,
  seed: string
): void {
  const entries: SquadEntry[] = squad
    .filter((s) => s.player)
    .map((s) => ({ player: s.player! }));

  if (entries.length === 0) return;

  const rng = seedrandom(`${seed}-tries-${fixture.round}`);
  const weights = getMatchWeights(entries, rng);
  const matchAlloc = allocateMatchTries(fixture.triesFor, weights, rng);
  applyScoringDetails(entries, [fixture], [matchAlloc], seed);
}

/**
 * Allocate tries from each fixture's simulated scoring breakdown.
 * Season totals are derived directly from per-match allocations.
 */
export function distributeSeasonTries(
  squad: SquadSlot[],
  fixtures: MatchFixture[],
  seed: string,
  seasonWins: number
): PlayerTryTotal[] {
  const entries: SquadEntry[] = squad
    .filter((s) => s.player)
    .map((s) => ({ player: s.player! }));

  if (entries.length === 0) return [];

  const rng = seedrandom(`${seed}-tries`);
  const perMatchAllocs: number[][] = [];

  for (const fixture of fixtures) {
    const weights = getMatchWeights(entries, rng);
    const matchAlloc = allocateMatchTries(fixture.triesFor, weights, rng);
    perMatchAllocs.push(matchAlloc);
  }

  const seasonTries = fixtures.reduce((sum, f) => sum + f.triesFor, 0);
  rebalanceTowardCaps(
    entries,
    perMatchAllocs,
    seasonTries,
    seasonWins,
    rng
  );

  applyScoringDetails(entries, fixtures, perMatchAllocs, seed);

  return aggregateTryTotalsFromFixtures(squad, fixtures);
}

export function getSeasonTryTotal(fixtures: MatchFixture[]): number {
  return fixtures.reduce((sum, f) => sum + f.triesFor, 0);
}
