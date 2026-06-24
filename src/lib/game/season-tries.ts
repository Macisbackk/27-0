import seedrandom from "seedrandom";
import type { Position, SquadSlot } from "../types";
import { getEffectivePeakRating } from "../squad-analysis";
import { isValidPlayerSlotPosition } from "./position-placement";
import { getPlayerDisplayClub } from "../players/run-club";
import { buildOpponentScoringDetail, buildEraTeamScoringDetail } from "./opponent-scorers";
import type { OpponentPoolOptions } from "./opponent-squad-strength";
import { getEraTeamByDisplayName } from "../players/era-teams";
import type {
  FixtureScoringDetail,
  MatchFixture,
  TeamScoringDetail,
} from "./season-simulation";
import { allocateMatchTries } from "./try-allocation";
import {
  getPlayerTryWeight,
  POSITION_SEASON_SHARE_MAX,
  POSITION_SOFT_TRY_GUIDE,
  POSITION_TRY_WEIGHT,
  SEASON_TRY_THEORETICAL_MAX,
} from "./try-weights";

export { POSITION_TRY_WEIGHT } from "./try-weights";

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

/** Soft target before rebalance/diminishing intensify — not a hard ceiling. */
function getSoftPositionTarget(
  position: Position,
  seasonTries: number
): number {
  const shareCap = Math.ceil(seasonTries * POSITION_SEASON_SHARE_MAX[position]);
  const guide = POSITION_SOFT_TRY_GUIDE[position];
  const scaledGuide = Math.ceil(guide * (1 + Math.min(0.25, seasonTries / 240)));
  return Math.min(
    SEASON_TRY_THEORETICAL_MAX,
    Math.max(shareCap, scaledGuide)
  );
}

function getPositionHighTryPenalty(position: Position, playerTotal: number): number {
  const tier = POSITION_TRY_WEIGHT[position];
  const softGuide = POSITION_SOFT_TRY_GUIDE[position];
  if (playerTotal <= softGuide) return 1;
  const excess = playerTotal - softGuide;
  const severity =
    tier >= 10 ? 0.07 : tier >= 6 ? 0.14 : tier >= 3 ? 0.2 : tier >= 1 ? 0.28 : 0.36;
  return 1 / (1 + excess * severity);
}

function getMinMatchWeight(position: Position): number {
  if (position === "PROP") return 0.045;
  if (position === "HOOKER") return 0.07;
  if (position === "SECOND_ROW" || position === "LOOSE_FORWARD") return 0.095;
  return 0.08;
}

function getTeammateRelativeSaturation(
  playerTotal: number,
  seasonTotalsSoFar: number[]
): number {
  const activeTotals = seasonTotalsSoFar.filter((t) => t > 0);
  const teamAvg =
    activeTotals.length > 0
      ? activeTotals.reduce((sum, t) => sum + t, 0) / activeTotals.length
      : 0;
  const leadAboveAvg = Math.max(0, playerTotal - teamAvg * 1.35);
  return 1 / (1 + playerTotal * 0.06 + leadAboveAvg * 0.18);
}

function getDominantShareThreshold(seasonTries: number): number {
  if (seasonTries < 45) return 0.14;
  if (seasonTries < 65) return 0.17;
  return 0.2;
}

function getSeasonAttackProfile(
  seasonWins: number,
  fixtureCount: number,
  seasonTries: number
): { winRate: number; triesPerGame: number; eliteAttack: boolean; weakAttack: boolean } {
  const winRate = fixtureCount > 0 ? seasonWins / fixtureCount : 0;
  const triesPerGame = fixtureCount > 0 ? seasonTries / fixtureCount : 0;
  return {
    winRate,
    triesPerGame,
    eliteAttack: winRate >= 0.62 && triesPerGame >= 4.2,
    weakAttack: winRate < 0.32 || triesPerGame < 2.8,
  };
}

function getBackTryModifier(
  position: Position,
  attack: ReturnType<typeof getSeasonAttackProfile>
): number {
  const tier = POSITION_TRY_WEIGHT[position];
  if (tier < 10) return 1;
  if (attack.weakAttack) return 0.78;
  if (attack.eliteAttack) return 1.12;
  return 1;
}

function getMatchWeights(
  entries: SquadEntry[],
  rng: () => number,
  seasonTotalsSoFar: number[],
  attack?: ReturnType<typeof getSeasonAttackProfile>
): number[] {
  return entries.map((e, i) => {
    const rating = getEffectivePeakRating(e.slot);
    const outOfPosition = !isValidPlayerSlotPosition(e.player, e.playedPosition);
    const ratingFactor =
      outOfPosition && e.player.peakRating > 0
        ? Math.max(0.75, rating / e.player.peakRating)
        : 1;
    const base =
      getPlayerTryWeight(e.player, e.playedPosition, rating) * ratingFactor;
    const saturation = getTeammateRelativeSaturation(
      seasonTotalsSoFar[i],
      seasonTotalsSoFar
    );
    const positionPenalty = getPositionHighTryPenalty(
      e.playedPosition,
      seasonTotalsSoFar[i]
    );
    const attackMod = attack
      ? getBackTryModifier(e.playedPosition, attack)
      : 1;
    const variance = 0.82 + rng() * 0.36;
    return Math.max(
      getMinMatchWeight(e.playedPosition),
      base * saturation * positionPenalty * attackMod * variance
    );
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
  seed: string,
  opponentOptions?: OpponentPoolOptions
): void {
  fixtures.forEach((fixture, fi) => {
    const eraOpponent = getEraTeamByDisplayName(fixture.opponent);
    fixture.scoringDetail = {
      dreamTeam: buildDreamTeamScoring(entries, perMatchAllocs[fi], fixture),
      opponent: eraOpponent
        ? buildEraTeamScoringDetail(
            fixture.opponent,
            fixture.triesAgainst,
            fixture.scoringAgainst,
            seed,
            `round-${fixture.round}`
          )
        : buildOpponentScoringDetail(fixture, seed, opponentOptions),
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
  if (weightSum <= 0) return candidates[0]?.i ?? 0;
  let pick = rng() * weightSum;
  for (const c of candidates) {
    pick -= c.weight;
    if (pick <= 0) return c.i;
  }
  return candidates[candidates.length - 1].i;
}

function buildAllocContext(
  entries: SquadEntry[],
  seasonTotalsSoFar: number[]
) {
  return {
    positions: entries.map((e) => e.playedPosition),
    ratings: entries.map((e) => getEffectivePeakRating(e.slot)),
    seasonTotalsSoFar: [...seasonTotalsSoFar],
  };
}

/**
 * Soft rebalance — nudges tries from players well above soft targets toward
 * underused teammates. Never hard-blocks the theoretical 34-try maximum.
 */
function rebalanceTowardSoftTargets(
  entries: SquadEntry[],
  perMatchAllocs: number[][],
  seasonTries: number,
  rng: () => number
): void {
  const softTargets = entries.map((e) =>
    getSoftPositionTarget(e.playedPosition, seasonTries)
  );
  const weights = entries.map((e) =>
    getPlayerTryWeight(e.player, e.playedPosition)
  );
  const maxIterations = Math.min(seasonTries * 2, 80);

  for (let guard = 0; guard < maxIterations; guard++) {
    const totals = getSeasonTotals(perMatchAllocs);
    const overIdx = totals.findIndex(
      (t, i) => t > softTargets[i] * 1.1 && t < SEASON_TRY_THEORETICAL_MAX
    );
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
        headroom: softTargets[i] - totals[i],
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

/**
 * Spread tries to underused squad members when one player dominates the season.
 */
function spreadSeasonConcentration(
  entries: SquadEntry[],
  perMatchAllocs: number[][],
  seasonTries: number,
  rng: () => number
): void {
  if (seasonTries < 12) return;

  const dominantThreshold = getDominantShareThreshold(seasonTries);
  const maxIterations = Math.min(seasonTries, 40);

  for (let guard = 0; guard < maxIterations; guard++) {
    const totals = getSeasonTotals(perMatchAllocs);
    const maxTotal = Math.max(...totals);
    const dominantIdx = totals.indexOf(maxTotal);
    const dominantShare = maxTotal / seasonTries;

    if (dominantShare < dominantThreshold) break;

    const underused = entries
      .map((e, i) => ({
        i,
        total: totals[i],
        weight: getPlayerTryWeight(e.player, e.playedPosition),
      }))
      .filter((c) => c.i !== dominantIdx && c.total <= Math.max(2, maxTotal * 0.42));

    if (underused.length === 0) break;

    const fixtureCandidates = perMatchAllocs
      .map((alloc, fi) => (alloc[dominantIdx] > 0 ? fi : -1))
      .filter((fi) => fi >= 0);
    if (fixtureCandidates.length === 0) break;

    const fi =
      fixtureCandidates[Math.floor(rng() * fixtureCandidates.length)];
    const alloc = perMatchAllocs[fi];
    const toIdx = pickWeightedIndex(
      underused.map((c) => ({ i: c.i, weight: c.weight })),
      rng
    );
    if (!transferTryInFixture(alloc, dominantIdx, toIdx)) break;
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
        club: getPlayerDisplayClub(p),
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
  seed: string,
  opponentOptions?: OpponentPoolOptions
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
  const seasonZeros = new Array(entries.length).fill(0);
  const weights = getMatchWeights(entries, rng, seasonZeros);
  const matchAlloc = allocateMatchTries(
    fixture.triesFor,
    weights,
    rng,
    buildAllocContext(entries, seasonZeros)
  );
  applyScoringDetails(entries, [fixture], [matchAlloc], seed, opponentOptions);
}

/** Core per-match try allocation — does not validate or reconcile totals. */
function allocateSeasonTriesToFixtures(
  squad: SquadSlot[],
  fixtures: MatchFixture[],
  seed: string,
  seasonWins: number,
  opponentOptions?: OpponentPoolOptions
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
  const seasonTotalsSoFar = new Array(entries.length).fill(0);
  const seasonTries = fixtures.reduce((sum, f) => sum + f.triesFor, 0);
  const attack = getSeasonAttackProfile(
    seasonWins,
    fixtures.length,
    seasonTries
  );

  for (const fixture of fixtures) {
    const weights = getMatchWeights(
      entries,
      rng,
      seasonTotalsSoFar,
      attack
    );
    const matchAlloc = allocateMatchTries(
      fixture.triesFor,
      weights,
      rng,
      buildAllocContext(entries, seasonTotalsSoFar)
    );
    perMatchAllocs.push(matchAlloc);
    for (let i = 0; i < entries.length; i++) {
      seasonTotalsSoFar[i] += matchAlloc[i];
    }
  }

  rebalanceTowardSoftTargets(entries, perMatchAllocs, seasonTries, rng);
  spreadSeasonConcentration(entries, perMatchAllocs, seasonTries, rng);

  applyScoringDetails(entries, fixtures, perMatchAllocs, seed, opponentOptions);
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
  seasonWins: number,
  options?: OpponentPoolOptions
): PlayerTryTotal[] {
  allocateSeasonTriesToFixtures(squad, fixtures, seed, seasonWins, options);
  return validateAndReconcileSeasonTries(
    squad,
    fixtures,
    seed,
    seasonWins,
    0,
    options
  );
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
  depth = 0,
  opponentOptions?: OpponentPoolOptions
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
      enrichSingleFixtureScoring(squad, fixture, seed, opponentOptions);
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
      allocateSeasonTriesToFixtures(
        squad,
        fixtures,
        seed,
        seasonWins,
        opponentOptions
      );
      return validateAndReconcileSeasonTries(
        squad,
        fixtures,
        seed,
        seasonWins,
        depth + 1,
        opponentOptions
      );
    }
  } else if (fixtureMismatch && depth < 1) {
    aggregated = aggregateTryTotalsFromFixtures(squad, fixtures);
    const recheckTotal = aggregated.reduce((sum, t) => sum + t.tries, 0);
    if (recheckTotal !== totalTeamTriesFromScores) {
      allocateSeasonTriesToFixtures(
        squad,
        fixtures,
        seed,
        seasonWins,
        opponentOptions
      );
      return validateAndReconcileSeasonTries(
        squad,
        fixtures,
        seed,
        seasonWins,
        depth + 1,
        opponentOptions
      );
    }
  }

  return aggregated;
}

export function getSeasonTryTotal(fixtures: MatchFixture[]): number {
  return fixtures.reduce((sum, f) => sum + f.triesFor, 0);
}
