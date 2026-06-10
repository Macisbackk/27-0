import seedrandom from "seedrandom";
import type { Position, SquadSlot } from "../types";
import { getEffectivePeakRating } from "../squad-analysis";
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
  WING: 0.22,
  CENTRE: 0.18,
  FULLBACK: 0.18,
  STAND_OFF: 0.16,
  SCRUM_HALF: 0.14,
  HOOKER: 0.06,
  SECOND_ROW: 0.12,
  LOOSE_FORWARD: 0.1,
  PROP: 0.04,
};

export interface PlayerTryTotal {
  playerId: string;
  name: string;
  club: string;
  /** Natural/database position. */
  position: Position;
  /** Slot position played this run (if different). */
  playedPosition?: Position;
  tries: number;
}

interface SquadEntry {
  player: SquadSlot["player"] & NonNullable<SquadSlot["player"]>;
  playedPosition: Position;
  slot: SquadSlot;
}

function getMaxIndividualTries(seasonWins: number, seasonTries: number): number {
  if (seasonWins <= 6) return Math.min(12, Math.max(5, Math.ceil(seasonTries * 0.2)));
  if (seasonWins <= 14) return Math.min(18, Math.max(8, Math.ceil(seasonTries * 0.22)));
  if (seasonWins <= 22) return Math.min(24, Math.max(10, Math.ceil(seasonTries * 0.24)));
  return Math.min(30, Math.max(12, Math.ceil(seasonTries * 0.26)));
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
    getPositionCap(entry.playedPosition, seasonTries)
  );
}

function getMatchWeights(
  entries: SquadEntry[],
  rng: () => number
): number[] {
  return entries.map((e) => {
    const ratingFactor =
      e.slot.runRatingPenalty
        ? Math.max(0.75, getEffectivePeakRating(e.slot) / e.player.peakRating)
        : 1;
    const base = getPlayerTryWeight(e.player, e.playedPosition) * ratingFactor;
    const variance = 0.9 + rng() * 0.2;
    return Math.max(0.05, base * variance);
  });
}

function pickKicker(entries: SquadEntry[]): SquadEntry | null {
  const halves = entries.filter(
    (e) =>
      e.playedPosition === "SCRUM_HALF" ||
      e.playedPosition === "STAND_OFF"
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
  const weights = entries.map((e) =>
    getPlayerTryWeight(e.player, e.playedPosition)
  );
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
  const filledSlots = squad.filter((s) => s.player);

  const totals = new Map<string, number>();

  for (const fixture of fixtures) {
    const scorers = fixture.scoringDetail?.dreamTeam.tryScorers ?? [];
    for (const s of scorers) {
      totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.tries);
    }
  }

  return filledSlots
    .map((slot) => {
      const p = slot.player!;
      return {
        playerId: p.id,
        name: p.name,
        club: p.club,
        position: p.position,
        playedPosition:
          slot.position !== p.position ? slot.position : undefined,
        tries: totals.get(p.id) ?? 0,
      };
    })
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
    .map((s) => ({
      player: s.player!,
      playedPosition: s.position,
      slot: s,
    }));

  if (entries.length === 0) return;

  const rng = seedrandom(`${seed}-tries-${fixture.round}`);
  const weights = getMatchWeights(entries, rng);
  const matchAlloc = allocateMatchTries(fixture.triesFor, weights, rng);
  applyScoringDetails(entries, [fixture], [matchAlloc], seed);
}

/** Core per-match try allocation — does not validate or reconcile totals. */
function allocateSeasonTriesToFixtures(
  squad: SquadSlot[],
  fixtures: MatchFixture[],
  seed: string,
  seasonWins: number
): boolean {
  const entries: SquadEntry[] = squad
    .filter((s) => s.player)
    .map((s) => ({
      player: s.player!,
      playedPosition: s.position,
      slot: s,
    }));

  if (entries.length === 0) return false;

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
  return true;
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
  allocateSeasonTriesToFixtures(squad, fixtures, seed, seasonWins);
  return validateAndReconcileSeasonTries(squad, fixtures, seed, seasonWins);
}

/**
 * Ensure fixture scoring events match triesFor and season totals reconcile.
 * Rebuilds per-fixture or full allocation on mismatch; returns fixture-derived totals only.
 */
export function validateAndReconcileSeasonTries(
  squad: SquadSlot[],
  fixtures: MatchFixture[],
  seed: string,
  seasonWins: number,
  depth = 0
): PlayerTryTotal[] {
  const totalTeamTriesFromScores = fixtures.reduce(
    (sum, f) => sum + f.triesFor,
    0
  );

  let fixtureMismatch = false;
  for (const fixture of fixtures) {
    const eventTries = (fixture.scoringDetail?.dreamTeam.tryScorers ?? []).reduce(
      (sum, s) => sum + s.tries,
      0
    );
    if (eventTries !== fixture.triesFor) {
      console.error(
        `[season-tries] Fixture round ${fixture.round}: scoring events (${eventTries}) !== triesFor (${fixture.triesFor}) — rebuilding fixture scoring`
      );
      enrichSingleFixtureScoring(squad, fixture, seed);
      fixtureMismatch = true;
    }
  }

  let aggregated = aggregateTryTotalsFromFixtures(squad, fixtures);
  const totalPlayerTriesFromEvents = aggregated.reduce(
    (sum, t) => sum + t.tries,
    0
  );

  if (totalPlayerTriesFromEvents !== totalTeamTriesFromScores) {
    console.error(
      `[season-tries] Season mismatch: player event tries (${totalPlayerTriesFromEvents}) !== team triesFor total (${totalTeamTriesFromScores})`
    );
    if (depth < 1) {
      allocateSeasonTriesToFixtures(squad, fixtures, seed, seasonWins);
      return validateAndReconcileSeasonTries(
        squad,
        fixtures,
        seed,
        seasonWins,
        depth + 1
      );
    }
  } else if (fixtureMismatch && depth < 1) {
    aggregated = aggregateTryTotalsFromFixtures(squad, fixtures);
    const recheckTotal = aggregated.reduce((sum, t) => sum + t.tries, 0);
    if (recheckTotal !== totalTeamTriesFromScores) {
      allocateSeasonTriesToFixtures(squad, fixtures, seed, seasonWins);
      return validateAndReconcileSeasonTries(
        squad,
        fixtures,
        seed,
        seasonWins,
        depth + 1
      );
    }
  }

  return aggregated;
}

export function getSeasonTryTotal(fixtures: MatchFixture[]): number {
  return fixtures.reduce((sum, f) => sum + f.triesFor, 0);
}
